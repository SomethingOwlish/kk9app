// ============================================================
// КК9 — Стартовый набор особенностей-характеров
// Раскладка по папкам: "Силы" / "Слабости".
// Уникальные возможности сюда НЕ кладём — их собирает ГМ вручную.
// Взято 1:1 из seed-features.mjs.
// ============================================================

export const FEATURES_DATA = [
  // ══════════════════════════════════════════════════════════
  // СИЛЫ
  // ══════════════════════════════════════════════════════════
  {
    name: "Изобретательность", img: "icons/svg/upgrade.svg", folder: "Силы", is_weakness: false,
    modifier: { target_agility: true, target_smarts: true, modifier: 2 },
    description: "в случае когда ты выкручиваешься подручными средствами — без нужного инструмента, не по инструкции, на ходу",
  },
  {
    name: "Дисциплинированность", img: "icons/svg/upgrade.svg", folder: "Силы", is_weakness: false,
    modifier: { target_smarts: true, target_spirit: true, die_change: 1 },
    description: "в случае когда ты действуешь строго по протоколу КК9 или по чёткому приказу, не отступая от него",
  },
  {
    name: "Хладнокровие", img: "icons/svg/upgrade.svg", folder: "Силы", is_weakness: false,
    modifier: { target_spirit: true, target_smarts: true, modifier: 2 },
    description: "в случае когда вокруг паника или хаос, а тебе нужно действовать так, будто ничего не происходит",
  },
  {
    name: "Чуткость", img: "icons/svg/upgrade.svg", folder: "Силы", is_weakness: false,
    modifier: { target_spirit: true, target_smarts: true, success_modifier: 1 },
    description: "в случае когда ты читаешь чувства или поддерживаешь человека, с которым у тебя есть близкая связь",
  },
  {
    name: "Любопытство", img: "icons/svg/upgrade.svg", folder: "Силы", is_weakness: false,
    modifier: { target_smarts: true, target_magic: true, extra_die_enabled: true, extra_die_faces: 6, extra_die_mode: "add" },
    description: "в случае когда ты разбираешься в чём-то новом и непонятном — аномалии, тайне, незнакомом устройстве",
  },
  {
    name: "Преданность", img: "icons/svg/upgrade.svg", folder: "Силы", is_weakness: false,
    modifier: { target_all: true, modifier: 2 },
    description: "в случае когда ты держишь данное своим обещание или долг, хотя бросить было бы проще",
  },
  {
    name: "Закалённость", img: "icons/svg/upgrade.svg", folder: "Силы", is_weakness: false,
    modifier: { target_spirit: true, die_change: 1 },
    description: "в случае когда тебя пытаются напугать, сломить или вывести из равновесия — ты уже видел вещи пострашнее",
  },
  {
    name: "Расчётливость", img: "icons/svg/upgrade.svg", folder: "Силы", is_weakness: false,
    modifier: { target_smarts: true, success_modifier: 1 },
    description: "в случае когда ты заранее всё просчитал и действуешь точно по плану",
  },
  {
    name: "Харизматичность", img: "icons/svg/upgrade.svg", folder: "Силы", is_weakness: false,
    modifier: { target_spirit: true, modifier: 2 },
    description: "в случае когда у тебя есть внимание собеседника и ты намеренно убеждаешь, очаровываешь или ведёшь за собой",
  },
  {
    name: "Внимательность", img: "icons/svg/upgrade.svg", folder: "Силы", is_weakness: false,
    modifier: { target_smarts: true, target_agility: true, extra_die_enabled: true, extra_die_faces: 6, extra_die_mode: "add" },
    description: "в случае когда ты без спешки осматриваешься и ищешь скрытое — ловушку, засаду, фальшь в словах",
  },

  // ══════════════════════════════════════════════════════════
  // СЛАБОСТИ
  // ══════════════════════════════════════════════════════════
  {
    name: "Гордыня", img: "icons/svg/downgrade.svg", folder: "Слабости", is_weakness: true,
    modifier: { target_spirit: true, target_smarts: true, die_change: -1 },
    description: "в случае когда тебе нужно попросить помощи, признать ошибку или отступить",
  },
  {
    name: "Вспыльчивость", img: "icons/svg/downgrade.svg", folder: "Слабости", is_weakness: true,
    modifier: { target_smarts: true, target_spirit: true, modifier: -2 },
    description: "в случае когда тебя только что задели за живое или оскорбили, а действовать надо хладнокровно, тонко или дипломатично",
  },
  {
    name: "Трусость", img: "icons/svg/downgrade.svg", folder: "Слабости", is_weakness: true,
    modifier: { target_all: true, die_change: -1 },
    description: "в случае когда тебе лично грозит реальная опасность и есть очевидный путь сбежать",
  },
  {
    name: "Брезгливость", img: "icons/svg/downgrade.svg", folder: "Слабости", is_weakness: true,
    modifier: { target_all: true, modifier: -2 },
    description: "в случае когда в этой сцене уже были кровь, гниль или мерзость, и ты от этого не оправился",
  },
  {
    name: "Самоуверенность", img: "icons/svg/downgrade.svg", folder: "Слабости", is_weakness: true,
    modifier: { target_all: true, success_modifier: -1 },
    description: "в случае когда ты заранее счёл дело лёгким и не стал готовиться или проверять",
  },
  {
    name: "Тревожность", img: "icons/svg/downgrade.svg", folder: "Слабости", is_weakness: true,
    modifier: { target_spirit: true, target_smarts: true, modifier: -2 },
    description: "в случае когда у тебя нет ясной информации, а воображение уже рисует худшее",
  },
  {
    name: "Импульсивность", img: "icons/svg/downgrade.svg", folder: "Слабости", is_weakness: true,
    modifier: { target_smarts: true, target_spirit: true, success_modifier: -1 },
    description: "в случае когда дело требует терпения и выдержки, а тебе хочется действовать прямо сейчас",
  },
  {
    name: "Жалостливость", img: "icons/svg/downgrade.svg", folder: "Слабости", is_weakness: true,
    modifier: { target_all: true, modifier: -2 },
    description: "в случае когда тебе нужно навредить, обмануть или бросить того, кто беспомощен или страдает",
  },
  {
    name: "Мстительность", img: "icons/svg/downgrade.svg", folder: "Слабости", is_weakness: true,
    modifier: { target_smarts: true, die_change: -1 },
    description: "в случае когда виновник твоей обиды рядом, а сосредоточиться надо на другом",
  },
  {
    name: "Зависимость от одобрения", img: "icons/svg/downgrade.svg", folder: "Слабости", is_weakness: true,
    modifier: { target_spirit: true, success_modifier: -1 },
    description: "в случае когда ты идёшь против воли наставника или начальства либо действуешь без их поддержки",
  },
];
