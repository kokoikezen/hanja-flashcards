(() => {
  let currentMode = "hanja";
  let pool = [];
  let currentCard = null;
  let answered = false;
  let stats = { correct: 0, total: 0 };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const el = {
    tabBtns: $$(".tab-btn"),
    quizArea: $("#quizArea"),
    quizEmptyState: $("#quizEmptyState"),
    quizQuestion: $("#quizQuestion"),
    quizForm: $("#quizForm"),
    inputMeaning: $("#inputMeaningAnswer"),
    inputReading: $("#inputReadingAnswer"),
    quizResult: $("#quizResult"),
    resultBadge: $("#resultBadge"),
    resultAnswer: $("#resultAnswer"),
    nextBtn: $("#nextBtn"),
    scoreCount: $("#scoreCount"),
    toast: $("#toast"),
  };

  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("show");
    setTimeout(() => el.toast.classList.remove("show"), 2000);
  }

  function updateScore() {
    el.scoreCount.innerHTML = stats.total
      ? `<span>${stats.correct}</span> / ${stats.total}문제 정답`
      : "";
  }

  function pickRandomCard() {
    if (pool.length === 0) return null;
    const idx = Math.floor(Math.random() * pool.length);
    return pool[idx];
  }

  function getMainText(card) {
    return currentMode === "hanja" ? card.hanja : card.idiom;
  }

  function renderQuestion() {
    currentCard = pickRandomCard();
    answered = false;
    el.quizResult.style.display = "none";
    el.quizForm.style.display = "flex";
    el.inputMeaning.value = "";
    el.inputReading.value = "";

    if (!currentCard) return;
    el.quizQuestion.textContent = getMainText(currentCard);
    setTimeout(() => el.inputMeaning.focus(), 50);
  }

  function showEmpty() {
    el.quizArea.style.display = "none";
    el.quizEmptyState.style.display = "block";
    el.scoreCount.innerHTML = "";
  }

  function showQuizArea() {
    el.quizArea.style.display = "block";
    el.quizEmptyState.style.display = "none";
  }

  async function switchMode(mode) {
    currentMode = mode;
    stats = { correct: 0, total: 0 };
    updateScore();

    el.tabBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.mode === mode);
    });

    pool = await CardStorage.loadData(mode);

    if (pool.length === 0) {
      showEmpty();
      return;
    }

    showQuizArea();
    renderQuestion();
  }

  function submitAnswer(e) {
    e.preventDefault();
    if (!currentCard || answered) return;
    answered = true;

    const result = CardStorage.gradeAnswer(
      currentCard,
      el.inputMeaning.value,
      el.inputReading.value
    );

    stats.total++;
    if (result.correct) stats.correct++;
    updateScore();

    el.resultBadge.textContent = result.correct ? "정답입니다! 🎉" : "오답입니다";
    el.resultBadge.className = "result-badge " + (result.correct ? "correct" : "wrong");
    el.resultAnswer.textContent = `정답 — 뜻: ${result.meaningAnswer}  /  음: ${result.readingAnswer}`;

    el.quizForm.style.display = "none";
    el.quizResult.style.display = "flex";
    el.nextBtn.focus();
  }

  el.tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => switchMode(btn.dataset.mode));
  });

  el.quizForm.addEventListener("submit", submitAnswer);
  el.nextBtn.addEventListener("click", renderQuestion);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && answered) {
      e.preventDefault();
      renderQuestion();
    }
  });

  switchMode("hanja");
})();
