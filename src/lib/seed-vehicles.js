export const VEHICLES_DATA = [
  { name: "Седан",          vehicleType: "ground",  speed: 180, toughness:  8, capacity:  5, description: "Стандартный городской автомобиль. Неприметный, манёвренный. Основной транспорт агентов на задании." },
  { name: "Мотоцикл",       vehicleType: "ground",  speed: 220, toughness:  4, capacity:  2, description: "Быстрый и манёвренный. Легко уходит от преследования в городе. Никакой защиты для водителя." },
  { name: "Внедорожник",    vehicleType: "ground",  speed: 150, toughness: 12, capacity:  7, description: "Проходит там где седан не пройдёт. Тяжёлый, заметный, надёжный. Хорош для эвакуации." },
  { name: "Грузовик",       vehicleType: "ground",  speed: 100, toughness: 16, capacity:  3, description: "Медленный, но вмещает людей и оборудование в кузове. Используется для транспортировки снаряжения." },
  { name: "Бронеавтомобиль",vehicleType: "ground",  speed: 120, toughness: 20, capacity:  6, description: "Защищённый транспорт. Выдерживает стрелковое оружие. Тяжёлый и заметный — не для скрытных операций." },
  { name: "Вертолёт",       vehicleType: "air",     speed: 250, toughness: 12, capacity:  8, description: "Манёвренный, может зависать. Шумный. Используется для эвакуации и быстрой переброски группы." },
  { name: "Самолёт",        vehicleType: "air",     speed: 800, toughness: 14, capacity: 20, description: "Для дальних перелётов. Требует взлётно-посадочной полосы. Основной транспорт между регионами." },
  { name: "Дельтаплан",     vehicleType: "air",     speed:  60, toughness:  2, capacity:  1, description: "Беззвучный. Используется для скрытного проникновения с воздуха. Никакой защиты, полная зависимость от ветра." },
  { name: "Катер",          vehicleType: "water",   speed:  80, toughness:  8, capacity:  6, description: "Быстрый моторный катер. Для операций на реках и прибрежных водах. Манёвренный, шумный." },
  { name: "Лодка",          vehicleType: "water",   speed:  20, toughness:  4, capacity:  4, description: "Вёсельная или с небольшим мотором. Тихая. Для скрытного передвижения по воде." },
  { name: "Ковёр-самолёт",  vehicleType: "magical", speed: 120, toughness:  3, capacity:  4, description: "Летающий ковёр. Бесшумный, манёвренный, работает в Верхнем мире. Никакой защиты — открытая платформа на высоте." },
  { name: "Метла",          vehicleType: "magical", speed: 160, toughness:  2, capacity:  1, description: "Быстрее ковра, управляется одним. Бесшумная. В Верхнем мире — один из немногих надёжных способов быстрого перемещения." },
];
