// =============================================
//  Firebase 설정 - 여기에 본인 Firebase 값 입력
// =============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs,
  deleteDoc, doc, serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDUZdaP8wT8eQTntWFXzHF1CcZWII343qk",
  authDomain: "japanese-fbc79.firebaseapp.com",
  projectId: "japanese-fbc79",
  storageBucket: "japanese-fbc79.firebasestorage.app",
  messagingSenderId: "147519296573",
  appId: "1:147519296573:web:407bec84bbb30e4f108654",
  measurementId: "G-V3RRGJSP99"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =============================================
//  전역 상태
// =============================================
let allWords = [];       // Firestore에서 불러온 전체 단어
let quizWords = [];      // 현재 퀴즈 단어 배열
let quizIndex = 0;
let correctCount = 0;
let wrongWords = [];
let quizMode = "kanji";  // kanji | meaning | reading
let quizFilter = "all";
let quizCount = 10;
let selectedLevel = "N5";
let currentModalWordId = null;

// =============================================
//  Firestore CRUD
// =============================================
async function loadWords() {
  const q = query(collection(db, "words"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  allWords = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  renderWordList(allWords);
  document.getElementById("word-count").textContent = allWords.length;
}

async function saveWord(word) {
  await addDoc(collection(db, "words"), {
    ...word,
    createdAt: serverTimestamp()
  });
  await loadWords();
}

async function deleteWord(id) {
  await deleteDoc(doc(db, "words", id));
  await loadWords();
}

// =============================================
//  단어 목록 렌더링
// =============================================
function renderWordList(words) {
  const list = document.getElementById("word-list");
  if (words.length === 0) {
    list.innerHTML = '<li class="empty-state">단어가 없어요</li>';
    return;
  }
  list.innerHTML = words.map(w => `
    <li class="word-item" data-id="${w.id}">
      <div class="word-item-kanji">${w.kanji || w.reading}</div>
      <div class="word-item-info">
        <div class="word-item-reading">${w.kanji ? w.reading : ''}</div>
        <div class="word-item-meaning">${w.meaning}</div>
      </div>
      ${w.level && w.level !== '-' ? `<span class="word-level">${w.level}</span>` : ''}
    </li>
  `).join('');

  list.querySelectorAll('.word-item').forEach(item => {
    item.addEventListener('click', () => openModal(item.dataset.id));
  });
}

// =============================================
//  단어 상세 모달
// =============================================
function openModal(id) {
  const w = allWords.find(x => x.id === id);
  if (!w) return;
  currentModalWordId = id;

  document.getElementById("modal-kanji").textContent = w.kanji || w.reading;
  document.getElementById("modal-reading").textContent = w.kanji ? w.reading : '';
  document.getElementById("modal-meaning").textContent = w.meaning;
  document.getElementById("modal-level").textContent = w.level || '';

  const exampleEl = document.getElementById("modal-example");
  if (w.example) {
    exampleEl.textContent = w.example;
    exampleEl.classList.remove('hidden');
  } else {
    exampleEl.classList.add('hidden');
  }

  document.getElementById("word-modal").classList.remove('hidden');
}

function closeModal() {
  document.getElementById("word-modal").classList.add('hidden');
  currentModalWordId = null;
}

// =============================================
//  탭 네비게이션
// =============================================
function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`page-${tabName}`).classList.add('active');
}

// =============================================
//  단어 추가 폼
// =============================================
function setupAddForm() {
  // 레벨 버튼
  document.querySelectorAll('.level-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.level-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedLevel = btn.dataset.level;
    });
  });

  document.getElementById("add-form").addEventListener("submit", async e => {
    e.preventDefault();
    const reading = document.getElementById("input-reading").value.trim();
    const meaning = document.getElementById("input-meaning").value.trim();
    if (!reading || !meaning) return;

    const submitBtn = e.target.querySelector('.btn-primary');
    submitBtn.textContent = '저장 중...';
    submitBtn.disabled = true;

    await saveWord({
      kanji: document.getElementById("input-kanji").value.trim(),
      reading,
      meaning,
      level: selectedLevel,
      example: document.getElementById("input-example").value.trim()
    });

    // 폼 초기화
    document.getElementById("add-form").reset();
    submitBtn.textContent = '저장하기';
    submitBtn.disabled = false;

    // 단어장으로 이동
    switchTab('list');
  });
}

// =============================================
//  검색
// =============================================
function setupSearch() {
  document.getElementById("search-input").addEventListener("input", e => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) { renderWordList(allWords); return; }
    const filtered = allWords.filter(w =>
      (w.kanji || '').includes(q) ||
      w.reading.includes(q) ||
      w.meaning.toLowerCase().includes(q)
    );
    renderWordList(filtered);
  });
}

// =============================================
//  퀴즈
// =============================================
function setupQuiz() {
  // 모드 버튼
  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      quizMode = btn.dataset.mode;
    });
  });

  // 필터 버튼
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      quizFilter = btn.dataset.filter;
    });
  });

  // 문제 수 버튼
  document.querySelectorAll('.count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      quizCount = btn.dataset.count === 'all' ? 'all' : parseInt(btn.dataset.count);
    });
  });

  document.getElementById("start-quiz-btn").addEventListener("click", startQuiz);
  document.getElementById("flash-card").addEventListener("click", flipCard);
  document.getElementById("btn-correct").addEventListener("click", () => nextCard(true));
  document.getElementById("btn-wrong").addEventListener("click", () => nextCard(false));
  document.getElementById("btn-retry").addEventListener("click", startQuiz);
  document.getElementById("btn-back-quiz").addEventListener("click", () => {
    showQuizSection('setup');
  });
}

function startQuiz() {
  let pool = quizFilter === 'all' ? [...allWords] : allWords.filter(w => w.level === quizFilter);
  if (pool.length === 0) {
    alert('해당 조건의 단어가 없어요!');
    return;
  }

  // 랜덤 셔플
  pool = pool.sort(() => Math.random() - 0.5);
  quizWords = quizCount === 'all' ? pool : pool.slice(0, Math.min(quizCount, pool.length));
  quizIndex = 0;
  correctCount = 0;
  wrongWords = [];

  showQuizSection('play');
  showCard();
}

function showCard() {
  const w = quizWords[quizIndex];
  const total = quizWords.length;
  document.getElementById("quiz-current").textContent = quizIndex + 1;
  document.getElementById("quiz-total").textContent = total;
  document.getElementById("progress-fill").style.width = `${((quizIndex) / total) * 100}%`;

  // 카드 앞면 설정
  let questionLabel = '';
  let questionText = '';

  if (quizMode === 'kanji') {
    questionLabel = '한자';
    questionText = w.kanji || w.reading;
  } else if (quizMode === 'meaning') {
    questionLabel = '한글 뜻';
    questionText = w.meaning;
  } else {
    questionLabel = '요미가나';
    questionText = w.reading;
  }

  document.getElementById("card-question-label").textContent = questionLabel;
  document.getElementById("card-question").textContent = questionText;

  // 카드 뒷면 설정
  document.getElementById("ans-kanji").textContent = w.kanji || '-';
  document.getElementById("ans-reading").textContent = w.reading;
  document.getElementById("ans-meaning").textContent = w.meaning;

  const exWrap = document.getElementById("ans-example-wrap");
  if (w.example) {
    document.getElementById("ans-example").textContent = w.example;
    exWrap.classList.remove('hidden');
  } else {
    exWrap.classList.add('hidden');
  }

  // 카드 초기화 (뒤집기 취소)
  const card = document.getElementById("flash-card");
  card.classList.remove('flipped');
  document.getElementById("quiz-actions").classList.add('hidden');
}

function flipCard() {
  const card = document.getElementById("flash-card");
  if (card.classList.contains('flipped')) return;
  card.classList.add('flipped');
  document.getElementById("quiz-actions").classList.remove('hidden');
}

function nextCard(isCorrect) {
  if (isCorrect) {
    correctCount++;
  } else {
    wrongWords.push(quizWords[quizIndex]);
  }
  quizIndex++;

  if (quizIndex >= quizWords.length) {
    showResult();
  } else {
    showCard();
  }
}

function showResult() {
  const total = quizWords.length;
  const pct = Math.round((correctCount / total) * 100);
  let emoji = '😢';
  let msg = '더 열심히 해봐요!';
  if (pct >= 90) { emoji = '🎉'; msg = '완벽해요!'; }
  else if (pct >= 70) { emoji = '👍'; msg = '잘했어요!'; }
  else if (pct >= 50) { emoji = '💪'; msg = '조금만 더!'; }

  document.getElementById("result-emoji").textContent = emoji;
  document.getElementById("result-score").textContent = `${correctCount} / ${total} (${pct}%)`;
  document.getElementById("result-msg").textContent = msg;
  document.getElementById("progress-fill").style.width = '100%';

  const wrongWrap = document.getElementById("wrong-list-wrap");
  if (wrongWords.length > 0) {
    const wrongList = document.getElementById("wrong-list");
    wrongList.innerHTML = wrongWords.map(w => `
      <li class="wrong-item">
        <span class="wrong-item-kanji">${w.kanji || w.reading}</span>
        <span class="wrong-item-reading">${w.kanji ? w.reading : ''}</span>
        <span class="wrong-item-meaning">${w.meaning}</span>
      </li>
    `).join('');
    wrongWrap.classList.remove('hidden');
  } else {
    wrongWrap.classList.add('hidden');
  }

  showQuizSection('result');
}

function showQuizSection(section) {
  document.getElementById("quiz-setup").classList.add('hidden');
  document.getElementById("quiz-play").classList.add('hidden');
  document.getElementById("quiz-result").classList.add('hidden');

  if (section === 'setup') document.getElementById("quiz-setup").classList.remove('hidden');
  else if (section === 'play') document.getElementById("quiz-play").classList.remove('hidden');
  else if (section === 'result') document.getElementById("quiz-result").classList.remove('hidden');
}

// =============================================
//  모달 이벤트
// =============================================
function setupModal() {
  document.querySelector(".modal-backdrop").addEventListener("click", closeModal);
  document.querySelector(".modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-delete").addEventListener("click", async () => {
    if (!currentModalWordId) return;
    if (confirm("이 단어를 삭제할까요?")) {
      await deleteWord(currentModalWordId);
      closeModal();
    }
  });
}

// =============================================
//  초기화
// =============================================
async function init() {
  // 탭 이벤트
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // 퀴즈 섹션 초기 상태
  showQuizSection('setup');

  setupAddForm();
  setupSearch();
  setupQuiz();
  setupModal();

  // 단어 로드
  try {
    await loadWords();
  } catch (err) {
    console.error("Firebase 연결 오류:", err);
    document.getElementById("word-list").innerHTML =
      '<li class="empty-state">⚠️ Firebase 설정을 확인해주세요<br><small>app.js의 firebaseConfig를 입력하세요</small></li>';
  }
}

init();
