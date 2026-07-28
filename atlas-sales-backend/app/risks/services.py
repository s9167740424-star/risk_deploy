RISK_RULES = {
    "railway":[(500,"high"),(1500,"medium"),(3000,"low")],
    "industrial_zone":[(1000,"high"),(3000,"medium"),(5000,"low")],
    "landfill":[(2000,"high"),(5000,"medium"),(10000,"low")],
    "highway":[(300,"high"),(1000,"medium"),(2500,"low")],
    "agricultural":[(1000,"medium"),(3000,"low")],
}
RISK_TITLES = {
    "railway":"Близость железной дороги",
    "industrial_zone":"Близость промышленной зоны",
    "landfill":"Близость полигона ТБО",
    "highway":"Близость крупной трассы",
    "agricultural":"Близость сельскохозяйственного объекта",
}
RECOMMENDATIONS = {
    "railway":"Проверьте фактический уровень шума в разные часы и отразите меры шумоизоляции.",
    "industrial_zone":"Уточните профиль предприятий, санитарные зоны и фактическое влияние на воздух и шум.",
    "landfill":"Проверьте статус объекта, розу ветров и официальные сведения о санитарной зоне.",
    "highway":"Оцените шум, качество воздуха и удобство безопасного доступа к объекту.",
    "agricultural":"Проверьте сезонные запахи, пыль, обработку полей и транспортную нагрузку.",
}
POSITIVE_TITLES = {
    "metro":"Близость метро","kindergarten":"Детский сад рядом",
    "school":"Школа рядом","park":"Парк рядом",
}

def severity(kind, distance_m):
    for max_distance, level in RISK_RULES.get(kind, []):
        if distance_m <= max_distance:
            return level
    return None

def analyze_nearby_object(obj):
    if obj.category == "positive":
        return {
            "type":"positive_factor","kind":obj.kind,
            "title":POSITIVE_TITLES.get(obj.kind,obj.name),
            "name":obj.name,"distance_m":obj.distance_m
        }
    level = severity(obj.kind, obj.distance_m)
    if level is None:
        return None
    return {
        "type":"risk","kind":obj.kind,
        "title":RISK_TITLES.get(obj.kind,obj.name),
        "name":obj.name,"severity":level,"distance_m":obj.distance_m,
        "reason":f"Объект расположен примерно в {obj.distance_m} м.",
        "recommendation":RECOMMENDATIONS.get(
            obj.kind,"Проведите дополнительную проверку влияния объекта на сделку."
        )
    }

def build_property_analysis(property_obj):
    factors = [x for x in (analyze_nearby_object(o) for o in property_obj.nearby_objects) if x]
    risks = [x for x in factors if x["type"] == "risk"]
    positives = [x for x in factors if x["type"] == "positive_factor"]
    counts = {
        "high":sum(1 for x in risks if x["severity"]=="high"),
        "medium":sum(1 for x in risks if x["severity"]=="medium"),
        "low":sum(1 for x in risks if x["severity"]=="low"),
    }
    overall = "high" if counts["high"] else ("medium" if counts["medium"] else "low")
    return {
        "property_id":property_obj.id,"overall_risk":overall,
        "risk_counts":counts,"risks":risks,"positive_factors":positives,
        "disclaimer":"Это предварительная rule-based оценка для MVP, а не юридическое заключение."
    }
