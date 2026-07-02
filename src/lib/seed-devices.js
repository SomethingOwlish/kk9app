// КК9 — Стартовые данные: Устройства
// deviceType: gadget / weapon / drone / computer / medical / other
// charges: -1 = бесконечно
// worksUpper: true = работает в Верхнем городе (механика)
// worksLower: true = работает в Нижнем городе (электроника)

export const DEVICES_DATA = [

  // ══ ГАДЖЕТЫ ═══════════════════════════════════════════════
  { folder: "Гаджеты", name: "Жучок-передатчик", deviceType: "gadget", creator: "", condition: "good", charges: -1, maxCharges: -1, equipped: "home", worksUpper: false, worksLower: true, bonusSkillName: "Наблюдательность", bonusValue: 1, description: "Миниатюрный радиопередатчик. Устанавливается незаметно. Радиус до 2 км." },
  { folder: "Гаджеты", name: "Детектор движения", deviceType: "gadget", creator: "", condition: "good", charges: -1, maxCharges: -1, equipped: "home", worksUpper: false, worksLower: true, bonusSkillName: "Наблюдательность", bonusValue: 2, description: "Инфракрасный сенсор. Реагирует на тепло и движение в радиусе 10 м." },
  { folder: "Гаджеты", name: "Глушитель сигнала", deviceType: "gadget", creator: "", condition: "good", charges: 20, maxCharges: 20, equipped: "home", worksUpper: false, worksLower: true, bonusSkillName: "Электроника", bonusValue: 1, description: "Подавляет радио, GSM, WiFi в радиусе 20 м. Заряды — часы работы." },
  { folder: "Гаджеты", name: "Прибор ночного видения", deviceType: "gadget", creator: "", condition: "good", charges: -1, maxCharges: -1, equipped: "home", worksUpper: false, worksLower: true, bonusSkillName: "Наблюдательность", bonusValue: 2, description: "Монокуляр ночного видения. Полностью устраняет штрафы за темноту." },
  { folder: "Гаджеты", name: "Тепловизор", deviceType: "gadget", creator: "", condition: "good", charges: -1, maxCharges: -1, equipped: "home", worksUpper: false, worksLower: true, bonusSkillName: "Наблюдательность", bonusValue: 1, description: "Видит тепловые сигнатуры сквозь тонкие препятствия." },
  { folder: "Гаджеты", name: "Портативный взломщик", deviceType: "gadget", creator: "", condition: "good", charges: 10, maxCharges: 10, equipped: "home", worksUpper: false, worksLower: true, bonusSkillName: "Взлом", bonusValue: 2, description: "Автоматизированный взломщик цифровых замков и сетей." },
  { folder: "Гаджеты", name: "Дрон-разведчик", deviceType: "drone", creator: "", condition: "good", charges: 20, maxCharges: 20, equipped: "home", worksUpper: false, worksLower: true, bonusSkillName: "Наблюдательность", bonusValue: 3, description: "Микродрон с камерой. Дальность 500 м. Заряды — минуты полёта." },
  { folder: "Гаджеты", name: "Маяк-локатор", deviceType: "gadget", creator: "", condition: "good", charges: -1, maxCharges: -1, equipped: "home", worksUpper: false, worksLower: true, bonusSkillName: "", bonusValue: 0, description: "GPS-маяк для отслеживания. Работает в паре с приложением на устройстве." },

  // ══ КОМПЬЮТЕРЫ ════════════════════════════════════════════
  { folder: "Компьютеры", name: "Планшет аналитика", deviceType: "computer", creator: "", condition: "good", charges: -1, maxCharges: -1, equipped: "home", worksUpper: false, worksLower: true, bonusSkillName: "Компьютеры", bonusValue: 2, description: "Мощный планшет с аналитическим ПО. Доступ к закрытым базам данных." },
  { folder: "Компьютеры", name: "Защищённый ноутбук", deviceType: "computer", creator: "", condition: "good", charges: -1, maxCharges: -1, equipped: "home", worksUpper: false, worksLower: true, bonusSkillName: "Взлом", bonusValue: 1, description: "Ноутбук с военным шифрованием. Защищён от внешнего взлома." },
  { folder: "Компьютеры", name: "Мобильный сервер", deviceType: "computer", creator: "", condition: "good", charges: -1, maxCharges: -1, equipped: "home", worksUpper: false, worksLower: true, bonusSkillName: "Компьютеры", bonusValue: 3, description: "Переносной серверный блок. Мощнее ноутбука, но громоздкий." },

  // ══ МЕДИЦИНСКИЕ ═══════════════════════════════════════════
  { folder: "Медицина", name: "Полевой медицинский набор", deviceType: "medical", creator: "", condition: "good", charges: 5, maxCharges: 5, equipped: "home", worksUpper: true, worksLower: true, bonusSkillName: "Первая помощь", bonusValue: 2, description: "Расширенная аптечка. Шины, жгут, антисептик, зажимы. Заряды — использований." },
  { folder: "Медицина", name: "Дефибриллятор", deviceType: "medical", creator: "", condition: "good", charges: 3, maxCharges: 3, equipped: "home", worksUpper: false, worksLower: true, bonusSkillName: "Медицина", bonusValue: 2, description: "Портативный дефибриллятор. Используется при остановке сердца." },
  { folder: "Медицина", name: "Диагностический сканер", deviceType: "medical", creator: "", condition: "good", charges: -1, maxCharges: -1, equipped: "home", worksUpper: false, worksLower: true, bonusSkillName: "Медицина", bonusValue: 1, description: "Портативный сканер жизненных показателей. Определяет внутренние травмы." },
  { folder: "Медицина", name: "Инъектор стимуляторов", deviceType: "medical", creator: "", condition: "good", charges: 3, maxCharges: 3, equipped: "home", worksUpper: false, worksLower: true, bonusSkillName: "", bonusValue: 0, description: "Автоматический инъектор. Три дозы стимулятора — применяется в поле." },

  // ══ МЕХАНИКА (Upper) ══════════════════════════════════════
  { folder: "Механика", name: "Механический замок-отмычка", deviceType: "gadget", creator: "", condition: "good", charges: -1, maxCharges: -1, equipped: "home", worksUpper: true, worksLower: false, bonusSkillName: "Взлом", bonusValue: 2, description: "Набор отмычек для механических замков. Работает без электричества." },
  { folder: "Механика", name: "Механический телескоп", deviceType: "gadget", creator: "", condition: "good", charges: -1, maxCharges: -1, equipped: "home", worksUpper: true, worksLower: true, bonusSkillName: "Наблюдательность", bonusValue: 2, description: "Оптический телескоп без электроники. Работает в обоих городах." },
  { folder: "Механика", name: "Хронометр точности", deviceType: "gadget", creator: "", condition: "good", charges: -1, maxCharges: -1, equipped: "home", worksUpper: true, worksLower: true, bonusSkillName: "", bonusValue: 0, description: "Механические часы с точностью до секунды. Незаменимы для координации." },
];
