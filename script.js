(() => {
  const STORAGE_KEY_HANJA = "hanja_cards";
  const STORAGE_KEY_SAJA = "saja_cards";

  let currentMode = "hanja";
  let currentIndex = 0;
  let isFlipped = false;
  let cards = [];

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
    emptyState: $("#emptyState"),
    quizControls: $("#quizControls"),
    navControls: $("#navControls"),
    oBtn: $("#oBtn"),
    xBtn: $("#xBtn"),
    prevBtn: $("#prevBtn"),
    nextBtn: $("#nextBtn"),
    pageIndicator: $("#pageIndicator"),
    addBtn: $("#addBtn"),
    resetBtn: $("#resetBtn"),
    modalOverlay: $("#modalOverlay"),
    modalTitle: $("#modalTitle"),
    modalFields: $("#modalFields"),
    modalConfirm: $("#modalConfirm"),
    modalCancel: $("#modalCancel"),
    toast: $("#toast"),
  };

  function loadData(mode) {
    const key = mode === "hanja" ? STORAGE_KEY_HANJA : STORAGE_KEY_SAJA;
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored);
    const defaults = mode === "hanja" ? DEFAULT_HANJA : DEFAULT_SAJA;
    localStorage.setItem(key, JSON.stringify(defaults));
    return JSON.parse(JSON.stringify(defaults));
  }

  function saveData(mode, data) {
    const key = mode === "hanja" ? STORAGE_KEY_HANJA : STORAGE_KEY_SAJA;
    localStorage.setItem(key, JSON.stringify(data));
  }

  function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    setTimeout(() => el.toast.classList.remove("show"), 2000);
  }

  function showCard() {
    if (cards.length === 0) {
      el.cardArea.style.display = "none";
      el.quizControls.style.display = "none";
      el.navControls.style.display = "none";
      el.emptyState.style.display = "block";
      el.cardCount.innerHTML = "";
      return;
    }

    el.cardArea.style.display = "block";
    el.quizControls.style.display = "flex";
    el.navControls.style.display = "flex";
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

    resetFlip();
    updateNavButtons();
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

  function nextCard() {
    if (cards.length === 0) return;
    currentIndex = (currentIndex + 1) % cards.length;
    showCard();
  }

  function prevCard() {
    if (cards.length === 0) return;
    currentIndex = (currentIndex - 1 + cards.length) % cards.length;
    showCard();
  }

  function updateNavButtons() {
    el.prevBtn.disabled = cards.length <= 1;
    el.nextBtn.disabled = cards.length <= 1;
  }

  function markKnown() {
    if (cards.length === 0) return;
    cards.splice(currentIndex, 1);
    if (currentIndex >= cards.length) currentIndex = 0;
    saveData(currentMode, cards);
    showCard();
    showToast("암기 완료! 카드 제거됨");
  }

  function markUnknown() {
    if (cards.length === 0) return;
    nextCard();
  }

  function switchMode(mode) {
    currentMode = mode;
    currentIndex = 0;
    isFlipped = false;
    cards = loadData(mode);

    el.tabBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });

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

    const newCard = isHanja
      ? { hanja: mainVal, reading: readingVal, meaning: meaningVal }
      : { idiom: mainVal, reading: readingVal, meaning: meaningVal };

    cards.push(newCard);
    saveData(currentMode, cards);
    currentIndex = cards.length - 1;
    showCard();
    closeModal();
    showToast(isHanja ? "한자가 추가되었습니다" : "사자성어가 추가되었습니다");
  }

  function resetData() {
    if (!confirm("모든 카드를 기본값으로 초기화하시겠습니까?")) return;
    const defaults = currentMode === "hanja" ? DEFAULT_HANJA : DEFAULT_SAJA;
    cards = JSON.parse(JSON.stringify(defaults));
    saveData(currentMode, cards);
    currentIndex = 0;
    showCard();
    showToast("기본값으로 초기화되었습니다");
  }

  el.tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => switchMode(btn.dataset.mode));
  });

  el.cardArea.addEventListener("click", flipCard);
  el.oBtn.addEventListener("click", markKnown);
  el.xBtn.addEventListener("click", markUnknown);
  el.prevBtn.addEventListener("click", prevCard);
  el.nextBtn.addEventListener("click", nextCard);
  el.addBtn.addEventListener("click", openAddModal);
  el.resetBtn.addEventListener("click", resetData);
  el.modalConfirm.addEventListener("click", confirmAdd);
  el.modalCancel.addEventListener("click", closeModal);

  el.modalOverlay.addEventListener("click", (e) => {
    if (e.target === el.modalOverlay) closeModal();
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
      case "ArrowLeft":
        prevCard();
        break;
      case "ArrowRight":
        nextCard();
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
