(() => {
  const STORAGE_KEY_HANJA = "hanja_cards";
  const STORAGE_KEY_SAJA = "saja_cards_v2";
  const OLD_STORAGE_KEY_SAJA = "saja_cards";

  const USER_KEY_HANJA = "user_hanja";
  const USER_KEY_SAJA = "user_saja";

  const OLD_DEFAULT_SAJA_IDIOMS = [
    "有備無患", "一日三秋", "臥薪嘗膽", "水落石出", "刻舟求劍", "虎頭蛇尾",
    "寒心之感", "難中有愛", "塵裏金瓶", "夢中之夢", "竹馬之友", "事必歸正",
    "不屈不撓", "任重道遠", "一石二鳥"
  ];

  async function fetchDefaultSaja() {
    try {
      const res = await fetch("hanmun.json");
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      return data.map((item) => ({
        idiom: item.hanja,
        reading: item.hangul,
        meaning: item.meaning,
      }));
    } catch {
      return JSON.parse(JSON.stringify(DEFAULT_SAJA));
    }
  }

  function migrateOldSaja(userCards) {
    return userCards.filter((c) => !OLD_DEFAULT_SAJA_IDIOMS.includes(c.idiom));
  }

  async function loadData(mode) {
    const key = mode === "hanja" ? STORAGE_KEY_HANJA : STORAGE_KEY_SAJA;
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);

    if (mode === "hanja") {
      const defaults = JSON.parse(JSON.stringify(DEFAULT_HANJA));
      localStorage.setItem(key, JSON.stringify(defaults));
      return defaults;
    }

    const base = await fetchDefaultSaja();

    let userAdded = [];
    const oldStored = localStorage.getItem(OLD_STORAGE_KEY_SAJA);
    if (oldStored) {
      userAdded = migrateOldSaja(JSON.parse(oldStored));
    }

    const defaults = base.concat(userAdded);
    localStorage.setItem(key, JSON.stringify(defaults));
    return defaults;
  }

  function saveData(mode, data) {
    const key = mode === "hanja" ? STORAGE_KEY_HANJA : STORAGE_KEY_SAJA;
    localStorage.setItem(key, JSON.stringify(data));
  }

  function getUserCards(mode) {
    const key = mode === "hanja" ? USER_KEY_HANJA : USER_KEY_SAJA;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  }

  function saveUserCards(mode, data) {
    const key = mode === "hanja" ? USER_KEY_HANJA : USER_KEY_SAJA;
    localStorage.setItem(key, JSON.stringify(data));
  }

  function addUserCard(mode, card) {
    const list = getUserCards(mode);
    const key = mode === "hanja" ? card.hanja : card.idiom;
    if (!list.some((c) => (mode === "hanja" ? c.hanja : c.idiom) === key)) {
      list.push(card);
      saveUserCards(mode, list);
    }
  }

  function syncUserCardsFromCurrent(mode, cards) {
    const isHanja = mode === "hanja";
    const defaults = new Set(
      isHanja
        ? DEFAULT_HANJA.map((c) => c.hanja)
        : DEFAULT_SAJA.map((c) => c.idiom)
    );

    const userList = getUserCards(mode);
    const userKeys = new Set(
      userList.map((c) => (isHanja ? c.hanja : c.idiom))
    );

    cards.forEach((c) => {
      const key = isHanja ? c.hanja : c.idiom;
      if (!defaults.has(key) && !userKeys.has(key)) {
        userList.push(c);
        userKeys.add(key);
      }
    });

    saveUserCards(mode, userList);
  }

  // ── 정답 비교(다의어/다중 음 대응) ──

  const ANSWER_DELIMITERS = /[/,，、;；·]+/;

  function normalizeAnswer(str) {
    return String(str || "")
      .normalize("NFC")
      .trim()
      .replace(/\s+/g, " ");
  }

  function normalizeTight(str) {
    return normalizeAnswer(str).replace(/\s+/g, "");
  }

  // 데이터에 여러 뜻/음이 배열(card.meanings, card.readings)로 저장되어 있으면
  // 그대로 사용하고, 아니면 "/", "," 등으로 구분된 하나의 문자열로 취급한다.
  function splitVariants(value) {
    if (Array.isArray(value)) {
      return value.map((v) => normalizeAnswer(v)).filter(Boolean);
    }
    return String(value || "")
      .split(ANSWER_DELIMITERS)
      .map((v) => normalizeAnswer(v))
      .filter(Boolean);
  }

  function getReadingVariants(card) {
    const source = card.readings && card.readings.length ? card.readings : card.reading;
    return Array.from(new Set(splitVariants(source)));
  }

  function getMeaningVariants(card) {
    const source = card.meanings && card.meanings.length ? card.meanings : card.meaning;
    const variants = new Set(splitVariants(source));

    // "집 가"처럼 뜻(훈)과 음이 함께 적힌 경우, 뜻만 입력해도 정답으로 인정
    const readingVariants = getReadingVariants(card);
    Array.from(variants).forEach((variant) => {
      readingVariants.forEach((reading) => {
        if (reading && variant.endsWith(" " + reading)) {
          const meaningOnly = normalizeAnswer(variant.slice(0, variant.length - reading.length));
          if (meaningOnly) variants.add(meaningOnly);
        }
      });
    });

    return Array.from(variants);
  }

  function matchesAnswer(userInput, variants) {
    const tightInput = normalizeTight(userInput);
    if (!tightInput) return false;

    return variants.some((variant) => {
      const tightVariant = normalizeTight(variant);
      if (!tightVariant) return false;
      if (tightInput === tightVariant) return true;

      // 사자성어처럼 긴 설명형 뜻은 핵심 내용을 충분히 담고 있으면 정답으로 인정
      if (tightVariant.length >= 6 && tightInput.length >= tightVariant.length * 0.6) {
        return tightVariant.includes(tightInput) || tightInput.includes(tightVariant);
      }
      return false;
    });
  }

  function gradeAnswer(card, userMeaning, userReading, options = {}) {
    const { requireMeaning = true } = options;
    const meaningVariants = getMeaningVariants(card);
    const readingVariants = getReadingVariants(card);

    const meaningCorrect = matchesAnswer(userMeaning, meaningVariants);
    const readingCorrect = matchesAnswer(userReading, readingVariants);

    return {
      correct: requireMeaning ? (meaningCorrect && readingCorrect) : readingCorrect,
      meaningCorrect,
      readingCorrect,
      meaningAnswer: Array.isArray(card.meanings) && card.meanings.length
        ? card.meanings.join(" / ")
        : card.meaning,
      readingAnswer: Array.isArray(card.readings) && card.readings.length
        ? card.readings.join(" / ")
        : card.reading,
    };
  }

  window.CardStorage = {
    STORAGE_KEY_HANJA,
    STORAGE_KEY_SAJA,
    USER_KEY_HANJA,
    USER_KEY_SAJA,
    loadData,
    saveData,
    getUserCards,
    saveUserCards,
    addUserCard,
    syncUserCardsFromCurrent,
    fetchDefaultSaja,
    gradeAnswer,
    getMeaningVariants,
    getReadingVariants,
  };
})();
