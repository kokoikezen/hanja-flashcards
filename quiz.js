(() => {
  let currentMode = "hanja";
  let pool = [];
  let queue = [];
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

  function shuffleArray(arr) {
    const result = arr.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function pickNextCard() {
    if (pool.length === 0) return null;

    if (queue.length === 0) {
      queue = shuffleArray(pool);
      // 방금 나온 문제가 새 회차의 맨 앞에 바로 다시 나오지 않도록 조정
      if (queue.length > 1 && queue[0] === currentCard) {
        [queue[0], queue[1]] = [queue[1], queue[0]];
      }
      if (currentCard) showToast("모든 문제를 다 풀었어요! 다시 섞어서 출제합니다");
    }

    return queue.shift();
  }

  function getMainText(card) {
    return currentMode === "hanja" ? card.hanja : card.idiom;
  }

  function renderQuestion() {
    currentCard = pickNextCard();
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

    el.inputMeaning.placeholder =
      mode === "hanja" ? "뜻을 입력하세요" : "뜻을 입력하세요 (선택, 채점 안 함)";

    pool = await CardStorage.loadData(mode);
    queue = shuffleArray(pool);
    currentCard = null;

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
      el.inputReading.value,
      { requireMeaning: currentMode === "hanja" }
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
