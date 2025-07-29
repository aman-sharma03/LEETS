
  // Inject your API key here...
  const your_API_key='<enter_your_key_here>';

(() => {

  // ✅ 1. Run only on LeetCode problem pages
  if (!/^https?:\/\/(www\.)?leetcode\.com\/problems\//.test(window.location.href)) return;
  
  // ✅ 2. Inject external CSS
  const cssLink = document.createElement('link');
  cssLink.rel = 'stylesheet';
  cssLink.href = chrome.runtime.getURL('style.css');
  document.head.appendChild(cssLink);

  // ✅ 3. Create overlay HTML
  const overlay = document.createElement('div');
  overlay.id = 'leets-overlay';
  overlay.innerHTML = `
    <div class="leets-header">
      <strong>💡 LEETS</strong>
      <div>
        <button id="leets-minimize" title="Minimize">–</button>
        <button id="leets-close" title="Close">&times;</button>
      </div>
    </div>
    <div id="leets-hint-container"></div>
    <div class="leets-buttons">
      <button id="leets-prev">Prev Hint</button>
      <button id="leets-next">Next Hint</button>
    </div>
  `;
  document.body.appendChild(overlay);

  // ✅ 4. DOM Elements
  const closeBtn = document.getElementById('leets-close');
  const minimizeBtn = document.getElementById('leets-minimize');
  const prevBtn = document.getElementById('leets-prev');
  const nextBtn = document.getElementById('leets-next');
  const hintContainer = document.getElementById('leets-hint-container');

  // ✅ 5. State Tracking
  let currentIndex = -1;
  let currentStage = 1;
  let fetchedHints = [];

  // ✅ 6. Minimize Behavior
  minimizeBtn.onclick = () => overlay.classList.toggle('leets-minimized');

  // ✅ 7. Close Overlay
  closeBtn.onclick = () => overlay.remove();

  // ✅ 8. Draggable Overlay
  const header = overlay.querySelector('.leets-header');
header.style.cursor = 'move';

let isDragging = false;
let startMouseX = 0, startMouseY = 0;
let startRight = 0, startBottom = 0;

let rafId = null;
let latestEvent = null;

header.addEventListener('mousedown', e => {
  isDragging = true;
  startMouseX = e.clientX;
  startMouseY = e.clientY;

  const computed = window.getComputedStyle(overlay);
  startRight  = parseFloat(computed.right);
  startBottom = parseFloat(computed.bottom);

  document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', e => {
  if (!isDragging) return;

  latestEvent = e;
  if (!rafId) {
    rafId = requestAnimationFrame(() => {
    const deltaX = latestEvent.clientX - startMouseX;
    const deltaY = latestEvent.clientY - startMouseY;

      overlay.style.right  = `${startRight  - deltaX}px`;
      overlay.style.bottom = `${startBottom - deltaY}px`;

      rafId = null;
    });
  }
});

document.addEventListener('mouseup', () => {
  isDragging = false;
  document.body.style.userSelect = '';
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
});



  // ✅ 10. Get LeetCode question text
  function getLeetcodeText() {
  const title = document.querySelector('.css-v3d350, .mr-2.text-label-1')?.innerText || '';
  const desc = document.querySelector('.content__u3I1.question-content__JfgR, .elfjS')?.innerText || '';

  let codeTemplate = '';
  const codeLines = document.querySelectorAll('.view-line');

  if (codeLines.length > 0) {
    codeLines.forEach(lineElement => {
      codeTemplate += lineElement.textContent + '\n';
    });
    codeTemplate = codeTemplate.trim();
  }

  let fullQuestionText = `${title}\n\n${desc}`;
  if (codeTemplate) {
    fullQuestionText += `\n\n--- Code Template ---\n${codeTemplate}`;
  }

  return fullQuestionText.trim();
}

  // ✅ 11. Render hint
  function showHint(text, stage) {
    hintContainer.innerHTML = `
      <div class="leets-hint">
        <h2>Hint ${stage}</h2>
        <pre class="leets-markdown">${text}</pre>
      </div>
    `;
    updateButtons();
  }

  // ✅ 12. Enable/Disable buttons
  function updateButtons() {
    prevBtn.disabled = currentIndex <= 0;
    nextBtn.disabled = currentIndex + 1 >= fetchedHints.length && currentStage > 5;
  }

  // ✅ 13. Fetch next hint from backend
  async function fetchNextHint() {
    const questionText = getLeetcodeText();
    if (!questionText) return alert('❌ Could not find question text.');

    // **Identical system prompt from main.py**:
    const systemPrompt = `
You are an AI coding mentor helping with a LeetCode question. The user will give the full question (title + description +template of code). You will give hints for stage {stage}.

- Stage 1: Simple thinking direction. No code at all. Just one-line bullet. try to explain the question at this stage more.
- Stage 2: Sharper pointers. Still no code. Bullet list.
- Stage 3: Close to solution logic. use pseudo codes \`\`\` blocks. only give pseudo codes in normal english language.
- Stage 4: Full solution of the question with a **short** explanation. don't add previous stages.

⚠️ Always follow these rules:
* Abide by the stage rules. give the full solution on stage 4 only
* At any stage dont include hints from previous stages. never!!
* Use the language that the template provides.
* If template is not given then give solution in c++
* make sure the answer you give in stage 4 should be using the template provided to you
* Break down hints using bullet points (use - or *).
* Add empty lines between bullets.
* Keep each bullet short (1-2 lines).
* Add proper spacing and line breaks so it's very easy to read.
* Wrap full code in triple backticks (\`\`\`).
* Never use headings like ## Stage or ## Explanation — go straight to content.
* No markdown headers at all (##, #, etc.).
* Add 1 blank line before and after any code block or bullet list.
`.replace('{stage}', currentStage);  // inject current stage

    try {
      nextBtn.disabled = true;
      nextBtn.innerText = 'Loading...';

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${your_API_key}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          model: "llama3-8b-8192",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user",  content: questionText }
          ]
        })
      });

      if (!res.ok) throw new Error(`AI error ${res.status}`);

      const data = await res.json();
      const hint = data.choices?.[0]?.message?.content?.trim() || 'No hint returned.';
      fetchedHints.push(hint);
      currentIndex++;
      currentStage++;
      showHint(hint, currentIndex + 1);

    } catch (err) {
      alert('⚠️ Error fetching hint:\n' + err.message);
      console.error(err);
    } finally {
      nextBtn.disabled = false;
      nextBtn.innerText = 'Next Hint';
    }
  }

  // ✅ 14. Button Listeners
  nextBtn.onclick = () => {
    if (currentIndex + 1 < fetchedHints.length) {
      currentIndex++;
      showHint(fetchedHints[currentIndex], currentIndex + 1);
    } else {
      fetchNextHint();
    }
  };

  prevBtn.onclick = () => {
    if (currentIndex > 0) {
      currentIndex--;
      showHint(fetchedHints[currentIndex], currentIndex + 1);
    }
  };
})();
