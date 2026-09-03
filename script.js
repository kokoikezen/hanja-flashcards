(() => {
  const STORAGE_KEY_HANJA = "hanja_cards";
  const STORAGE_KEY_SAJA = "saja_cards_v2";
  const OLD_STORAGE_KEY_SAJA = "saja_cards";

  const USER_KEY_HANJA = "user_hanja";
  const USER_KEY_SAJA = "user_saja";
  const STORAGE_KEY_SHUFFLE = "shuffle_mode";

  const OLD_DEFAULT_SAJA_IDIOMS = [
    "有備無患", "一日三秋", "臥薪嘗膽", "水落石出", "刻舟求劍", "虎頭蛇尾",
    "寒心之感", "難中有愛", "塵裏金瓶", "夢中之夢", "竹馬之友", "事必歸正",
    "不屈不撓", "任重道遠", "一石二鳥"
  ];

  let currentMode = "hanja";
  let currentIndex = 0;
  let isFlipped = false;
  let cards = [];
  let reviewCounts = {};
  let shuffleMode = localStorage.getItem(STORAGE_KEY_SHUFFLE) === "true";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const el = {
    tabBtns: $$(".tab-btn"),
    cardArea: $("#cardArea"),
    cardContainer: $("#cardContainer"),
    mainText: $("#mainText"),
    subText: $("#subText"),
    readingText: $("#readingText"),
    meaningText: $("#meaningText"),
    cardCount: $("#cardCount"),
    cardBadge: $("#cardBadge"),
    emptyState: $("#emptyState"),
    quizControls: $("#quizControls"),
    oBtn: $("#oBtn"),
    xBtn: $("#xBtn"),
    addBtn: $("#addBtn"),
    resetBtn: $("#resetBtn"),
    modalOverlay: $("#modalOverlay"),
    modalTitle: $("#modalTitle"),
    modalFields: $("#modalFields"),
    modalConfirm: $("#modalConfirm"),
    modalCancel: $("#modalCancel"),
    toast: $("#toast"),
    menuBtn: $("#menuBtn"),
    dropdownMenu: $("#dropdownMenu"),
    shuffleToggle: $("#shuffleToggle"),
    shuffleLabel: $("#shuffleLabel"),
  };

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

  function syncUserCardsFromCurrent(mode) {
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

  function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function updateShuffleLabel() {
    el.shuffleLabel.textContent = shuffleMode ? "무작위" : "순서대로";
  }

  function toggleShuffle() {
    shuffleMode = !shuffleMode;
    localStorage.setItem(STORAGE_KEY_SHUFFLE, shuffleMode);
    updateShuffleLabel();
    switchMode(currentMode);
    showToast(shuffleMode ? "무작위 순서로 변경" : "순서대로 변경");
  }

  function toggleMenu() {
    el.dropdownMenu.classList.toggle("open");
  }

  function closeMenu() {
    el.dropdownMenu.classList.remove("open");
  }

  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    setTimeout(() => el.toast.classList.remove("show"), 2000);
  }

  function setLoading() {
    el.cardArea.style.display = "none";
    el.quizControls.style.display = "none";
    el.emptyState.style.display = "block";
    el.emptyState.querySelector(".empty-icon").textContent = "⏳";
    el.emptyState.querySelector("p").textContent = "불러오는 중...";
    el.emptyState.querySelector(".sub").textContent = "";
    el.cardCount.innerHTML = "";
  }

  function showCard() {
    if (cards.length === 0) {
      el.cardArea.style.display = "none";
      el.quizControls.style.display = "none";
      el.emptyState.style.display = "block";
      el.emptyState.querySelector(".empty-icon").textContent = "📖";
      el.emptyState.querySelector("p").textContent = "카드가 없습니다";
      el.emptyState.querySelector(".sub").textContent = "+ 버튼으로 새 카드를 추가하세요";
      el.cardCount.innerHTML = "";
      return;
    }

    el.cardArea.style.display = "block";
    el.quizControls.style.display = "flex";
    el.emptyState.style.display = "none";

    const card = cards[currentIndex];
    const isHanja = currentMode === "hanja";

    el.mainText.textContent = isHanja ? card.hanja : card.idiom;
    el.subText.textContent = isHanja
      ? `총 ${cards.length}개 중 ${currentIndex + 1}번째`
      : `총 ${cards.length}개 중 ${currentIndex + 1}번째`;
    el.readingText.textContent = card.reading;
    el.meaningText.textContent = card.meaning;

    el.cardCount.innerHTML =
      `<span>${currentIndex + 1}</span> / ${cards.length}`;

    const cardKey = isHanja ? card.hanja : card.idiom;
    const count = reviewCounts[cardKey] || 0;
    el.cardBadge.style.display = count > 0 ? "block" : "none";
    el.cardBadge.textContent = count > 0 ? `다시 보기 ×${count}` : "";

    resetFlip();
  }

  function resetFlip() {
    isFlipped = false;
    el.cardContainer.classList.remove("flipped");
  }

  function flipCard() {
    if (cards.length === 0) return;
    isFlipped = !isFlipped;
    el.cardContainer.classList.toggle("flipped");
  }

  function markKnown() {
    if (cards.length === 0) return;
    const cardKey = currentMode === "hanja"
      ? cards[currentIndex].hanja
      : cards[currentIndex].idiom;
    delete reviewCounts[cardKey];
    cards.splice(currentIndex, 1);
    if (currentIndex >= cards.length) currentIndex = 0;
    saveData(currentMode, cards);
    showCard();
    showToast("암기 완료! 카드 제거됨");
  }

  function markUnknown() {
    if (cards.length === 0) return;
    const card = cards[currentIndex];
    const cardKey = currentMode === "hanja" ? card.hanja : card.idiom;
    reviewCounts[cardKey] = (reviewCounts[cardKey] || 0) + 1;
    currentIndex = (currentIndex + 1) % cards.length;
    showCard();
  }

  async function switchMode(mode) {
    currentMode = mode;
    currentIndex = 0;
    isFlipped = false;
    reviewCounts = {};

    el.tabBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });

    setLoading();
    cards = await loadData(mode);
    if (shuffleMode) cards = shuffleArray(cards);
    syncUserCardsFromCurrent(mode);
    showCard();
  }

  function openAddModal() {
    const isHanja = currentMode === "hanja";
    el.modalTitle.textContent = isHanja ? "한자 추가" : "사자성어 추가";

    if (isHanja) {
      el.modalFields.innerHTML = `
        <div class="form-group">
          <label>한자</label>
          <input type="text" id="inputMain" maxlength="1" placeholder="예: 學">
        </div>
        <div class="form-group">
          <label>읽기 (한국어 발음)</label>
          <input type="text" id="inputReading" placeholder="예: 학">
        </div>
        <div class="form-group">
          <label>뜻</label>
          <input type="text" id="inputMeaning" placeholder="예: 배울 학">
        </div>
      `;
    } else {
      el.modalFields.innerHTML = `
        <div class="form-group">
          <label>사자성어</label>
          <input type="text" id="inputMain" maxlength="4" placeholder="예: 有備無患">
        </div>
        <div class="form-group">
          <label>읽기 (한국어 발음)</label>
          <input type="text" id="inputReading" placeholder="예: 유비무환">
        </div>
        <div class="form-group">
          <label>뜻</label>
          <input type="text" id="inputMeaning" placeholder="예: 미리 준비하면 화가 없다">
        </div>
      `;
    }

    el.modalOverlay.classList.add("show");
    setTimeout(() => {
      const firstInput = el.modalFields.querySelector("input");
      if (firstInput) firstInput.focus();
    }, 300);
  }

  function closeModal() {
    el.modalOverlay.classList.remove("show");
    el.modalFields.innerHTML = "";
  }

  function confirmAdd() {
    const isHanja = currentMode === "hanja";
    const mainVal = $("#inputMain")?.value.trim();
    const readingVal = $("#inputReading")?.value.trim();
    const meaningVal = $("#inputMeaning")?.value.trim();

    if (!mainVal || !readingVal || !meaningVal) {
      showToast("모든 항목을 입력하세요");
      return;
    }

    if (isHanja && !/^[\u4E00-\u9FFF]{1}$/.test(mainVal)) {
      showToast("한자만 입력하세요");
      return;
    }

    const newCard = isHanja
      ? { hanja: mainVal, reading: readingVal, meaning: meaningVal }
      : { idiom: mainVal, reading: readingVal, meaning: meaningVal };

    cards.push(newCard);
    saveData(currentMode, cards);
    addUserCard(currentMode, newCard);
    currentIndex = cards.length - 1;
    showCard();
    closeModal();
    showToast(isHanja ? "한자가 추가되었습니다" : "사자성어가 추가되었습니다");
  }

  async function resetData() {
    const choice = prompt(
      "초기화 방식을 선택하세요 (1: 취소, 2: 추가분만 남기고 초기화, 3: 전체 초기화)"
    );
    if (choice === null || choice === "1" || choice === "") {
      showToast("초기화 취소됨");
      return;
    }

    if (choice === "2") {
      const isHanja = currentMode === "hanja";
      const defaults = isHanja
        ? JSON.parse(JSON.stringify(DEFAULT_HANJA))
        : await fetchDefaultSaja();

      const userAdded = getUserCards(currentMode);

      cards = defaults.concat(userAdded);
      if (shuffleMode) cards = shuffleArray(cards);
      saveData(currentMode, cards);
      currentIndex = 0;
      reviewCounts = {};
      showCard();
      showToast("추가분만 남기고 초기화됨");
      return;
    }

    if (choice === "3") {
      const isHanja = currentMode === "hanja";
      if (isHanja) {
        cards = JSON.parse(JSON.stringify(DEFAULT_HANJA));
        if (shuffleMode) cards = shuffleArray(cards);
        saveData(currentMode, cards);
      } else {
        localStorage.removeItem(STORAGE_KEY_SAJA);
        cards = await fetchDefaultSaja();
        if (shuffleMode) cards = shuffleArray(cards);
        saveData(currentMode, cards);
      }

      saveUserCards(currentMode, []);
      currentIndex = 0;
      reviewCounts = {};
      showCard();
      showToast("전체 초기화되었습니다");
      return;
    }

    showToast("잘못된 선택입니다. 취소됨");
  }

  el.tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => switchMode(btn.dataset.mode));
  });

  el.cardArea.addEventListener("click", flipCard);
  el.oBtn.addEventListener("click", markKnown);
  el.xBtn.addEventListener("click", markUnknown);
  el.addBtn.addEventListener("click", openAddModal);
  el.resetBtn.addEventListener("click", resetData);
  el.modalConfirm.addEventListener("click", confirmAdd);
  el.modalCancel.addEventListener("click", closeModal);

  el.modalOverlay.addEventListener("click", (e) => {
    if (e.target === el.modalOverlay) closeModal();
  });

  el.menuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMenu();
  });

  el.shuffleToggle.addEventListener("click", () => {
    toggleShuffle();
    closeMenu();
  });

  document.addEventListener("click", (e) => {
    if (!el.menuBtn.contains(e.target) && !el.dropdownMenu.contains(e.target)) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (el.modalOverlay.classList.contains("show")) {
      if (e.key === "Enter") confirmAdd();
      if (e.key === "Escape") closeModal();
      return;
    }

    switch (e.key) {
      case " ":
        e.preventDefault();
        flipCard();
        break;
      case "o":
      case "O":
        markKnown();
        break;
      case "x":
      case "X":
        markUnknown();
        break;
    }
  });

  switchMode("hanja");
})();
