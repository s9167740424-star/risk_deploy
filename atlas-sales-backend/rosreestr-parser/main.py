import asyncio
import os
import re
import json
from datetime import datetime
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
from playwright.async_api import async_playwright
from contextlib import asynccontextmanager

def _env_ms(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default
NAV_TIMEOUT = _env_ms("PARSER_NAV_TIMEOUT", 60000)
UI_TIMEOUT = _env_ms("PARSER_UI_TIMEOUT", 20000)
RESULT_TIMEOUT = _env_ms("PARSER_RESULT_TIMEOUT", 25000)
NAV_RETRIES = int(os.getenv("PARSER_NAV_RETRIES", "2"))
CADASTRAL_RE = re.compile(r'\b\d{1,2}:\d{1,2}:\d{5,7}:\d{1,10}\b')
CADASTRAL_RE_LOOSE = re.compile(r'\b\d{1,2}:\d{1,2}:\d{5,7}(?::\d{1,10})?\b')

class CoordinatesRequest(BaseModel):
    latitude: float
    longitude: float

class PlotResponse(BaseModel):
    cadastral_number: str
    coordinates: dict
    info: dict
    fields_count: int
    timestamp: str

def extract_cadastral_number(text: str) -> str | None:
    if not text:
        return None
    match = CADASTRAL_RE.search(text)
    if match:
        return match.group(0)
    match = CADASTRAL_RE_LOOSE.search(text)
    if match:
        return match.group(0)
    return None

class RosreestrParser:
    def __init__(self):
        self.base_url = "https://nspd.gov.ru/map?thematic=PKK&coordinate_x=4221015.012247635&coordinate_y=7574181.562236419&zoom=11.630095020104767&baseLayerId=235&theme_id=1&is_copy_url=true&active_layers=36048"
        self.browser = None
        self.playwright = None
        self.lock = asyncio.Lock()
        self.page_pool = []
        self.max_pages = 3
        self.last_error = None
    async def init_browser(self):
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=True,
            args=[
                '--ignore-certificate-errors',
                '--disable-web-security',
                '--no-sandbox',
                '--single-process',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-setuid-sandbox',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding'
            ]
        )
    async def close_browser(self):
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
    async def create_context_and_page(self):
        context = await self.browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            ignore_https_errors=True,
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )
        page = await context.new_page()
        page.on('dialog', lambda dialog: asyncio.create_task(dialog.accept()))
        return context, page
    async def close_context(self, context):
        await context.close()
    async def load_page(self, page):
        last_error = None
        for attempt in range(1, NAV_RETRIES + 1):
            try:
                await page.goto(
                    self.base_url,
                    timeout=NAV_TIMEOUT,
                    wait_until='domcontentloaded'
                )
                await page.wait_for_selector(
                    'm-button.coordinate-search',
                    timeout=UI_TIMEOUT
                )
                return True
            except Exception as e:
                last_error = e
                print(
                    f"Попытка {attempt}/{NAV_RETRIES}: страница НСПД "
                    f"не загрузилась ({type(e).__name__})"
                )
                if attempt < NAV_RETRIES:
                    await asyncio.sleep(2)
        print(f"Error loading page: {last_error}")
        self.last_error = (
            "Сайт nspd.gov.ru не отвечает или загружается слишком долго. "
            "Проверьте, открывается ли https://nspd.gov.ru/map в браузере."
        )
        return False
    async def close_banner(self, page):
        try:
            button = await page.query_selector('button:has-text("Закрыть")')
            if button and await button.is_visible():
                await button.click()
                await asyncio.sleep(0.2)
                return True
            return False
        except:
            return False
    async def open_search_form(self, page):
        try:
            search_button = await page.query_selector('m-button.coordinate-search')
            if not search_button:
                search_button = await page.query_selector('button.button.outlined-icon.medium.left')
            if search_button and await search_button.is_visible():
                await search_button.click()
                await page.wait_for_selector('#latitude', timeout=UI_TIMEOUT)
                return True
            return False
        except Exception as e:
            print(f"Error opening search form: {e}")
            return False
    async def enter_coordinates(self, page, lat, lon):
        try:
            lat_input = await page.query_selector('#latitude')
            if lat_input:
                await lat_input.click()
                await lat_input.fill(str(lat))
            lon_input = await page.query_selector('#longitude')
            if lon_input:
                await lon_input.click()
                await lon_input.fill(str(lon))
            return True
        except Exception as e:
            print(f"Error entering coordinates: {e}")
            return False
    async def click_find(self, page):
        try:
            find_button = await page.query_selector('button:has-text("Найти")')
            if find_button and await find_button.is_visible():
                await find_button.click()
                await page.wait_for_selector('.accordion-item.clickable', timeout=RESULT_TIMEOUT)
                return True
            return False
        except Exception as e:
            print(f"Error clicking find: {e}")
            return False
    async def select_first_plot(self, page):
        try:
            plot_element = await page.query_selector('.accordion-item.clickable')
            if not plot_element:
                return None
            plot_text = await plot_element.text_content() or ''
            cadastral_number = extract_cadastral_number(plot_text)
            if not cadastral_number:
                print(
                    "Не удалось разобрать кадастровый номер из текста: "
                    f"{plot_text.strip()[:120]!r}"
                )
            await plot_element.click()
            await page.wait_for_selector('.info-container', timeout=RESULT_TIMEOUT)
            return cadastral_number
        except Exception as e:
            print(f"Error selecting plot: {e}")
            return None
    async def extract_plot_info(self, page):
        try:
            info_containers = await page.query_selector_all('.info-container')
            if not info_containers:
                return {}
            info = {}
            for container in info_containers:
                try:
                    label_element = await container.query_selector('m-typography[type="p3"]')
                    if not label_element:
                        continue
                    label = await label_element.get_attribute('text')
                    if not label:
                        label = await label_element.text_content()
                    label = label.strip() if label else ''
                    value = ''
                    string_item = await container.query_selector('m-string-item')
                    if string_item:
                        value = await string_item.get_attribute('text')
                        if not value:
                            value = await string_item.text_content()
                    if not value:
                        typography = await container.query_selector('m-typography[type="p1"]')
                        if typography:
                            value = await typography.get_attribute('text')
                            if not value:
                                value = await typography.text_content()
                    value = value.strip() if value else ''
                    if label and value and len(label) > 1:
                        value = value.replace('\u00a0', ' ')
                        info[label] = value
                except Exception as e:
                    continue
            return info
        except Exception as e:
            print(f"Error extracting info: {e}")
            return {}
    async def parse_plot(self, lat, lon):
        async with self.lock:
            context = None
            page = None
            self.last_error = None
            try:
                context, page = await self.create_context_and_page()
                if not await self.load_page(page):
                    return None
                await self.close_banner(page)
                if not await self.open_search_form(page):
                    self.last_error = (
                        "Не найдена форма поиска по координатам — "
                        "возможно, изменилась вёрстка сайта НСПД."
                    )
                    return None
                if not await self.enter_coordinates(page, lat, lon):
                    self.last_error = "Не удалось ввести координаты в форму."
                    return None
                if not await self.click_find(page):
                    self.last_error = (
                        "Поиск не дал результатов: по этим координатам "
                        "участок не найден либо сайт не ответил."
                    )
                    return None
                cadastral_number = await self.select_first_plot(page)
                if not cadastral_number:
                    self.last_error = (
                        "Участок по этим координатам не найден "
                        "в публичной кадастровой карте."
                    )
                    return None
                info = await self.extract_plot_info(page)
                result = {
                    'cadastral_number': cadastral_number,
                    'coordinates': {'latitude': lat, 'longitude': lon},
                    'info': info,
                    'fields_count': len(info),
                    'timestamp': datetime.now().isoformat()
                }
                return result
            except Exception as e:
                print(f"Critical error: {e}")
                return None
            finally:
                if page:
                    await page.close()
                if context:
                    await context.close()
parser = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global parser
    parser = RosreestrParser()
    await parser.init_browser()
    print("Browser initialized")
    yield
    await parser.close_browser()
app = FastAPI(lifespan=lifespan)

@app.post("/parse", response_model=PlotResponse)
async def parse_coordinates(request: CoordinatesRequest):
    try:
        result = await parser.parse_plot(request.latitude, request.longitude)
        if not result:
            reason = getattr(parser, "last_error", None)
            is_site_problem = bool(reason and (
                "не отвечает" in reason or "вёрстка" in reason
            ))
            raise HTTPException(
                status_code=503 if is_site_problem else 404,
                detail=reason or "Участок не найден"
            )
        return result
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing request: {str(e)}"
        )

@app.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
