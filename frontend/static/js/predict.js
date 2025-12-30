// Signify Frontend Prediction Logic
// ---------------------------------
// Handles webcam input, prediction requests, UI updates, and audio playback.
// Author: <Your Name>
// Date: 2025

(async function(){
  const wordsBox = document.getElementById('wordsBox');
  const sentenceBox = document.getElementById('sentenceBox');
  const autoBox = document.getElementById('autoBox');
  const playBtn = document.getElementById('playBtn');
  const audioName = document.getElementById('audioName');
  const ttsPlayer = document.getElementById('ttsPlayer');
  const videoFeed = document.querySelector('.video-feed');
  const videoControls = document.querySelector('.video-controls');
  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const resumeBtn = document.getElementById('resumeBtn');

  // Session management
  let sessionId = localStorage.getItem('signify_session_id');
  if (!sessionId) {
    try {
      const r = await fetch('/session', { method: 'POST' });
      const j = await r.json();
      sessionId = j.session_id;
      localStorage.setItem('signify_session_id', sessionId);
    } catch (e) {
      console.error('session error', e);
    }
  }

  // Webcam stream management
  let stream = null;

  // Capture current frame from webcam as JPEG data URL
  function captureFrameDataUrl() {
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 240;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(webcam, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.6);
  }

  // Send frame to backend and update UI
  let sending = false;
  async function sendFrameAndUpdate() {
    if (sending) return;
    sending = true;
    try {
      const dataUrl = captureFrameDataUrl();
      const res = await fetch('/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
        body: JSON.stringify({ image: dataUrl })
      });
      const j = await res.json();
      if (!j.error) {
        wordsBox.innerText = j.word || "";
        // j.sentence may be an array of word objects when returned from /space
        if (Array.isArray(j.sentence)) {
          renderSentenceArray(j.sentence);
        } else {
          sentenceBox.innerText = j.sentence || "";
        }
      }
    } catch (e) {
      console.error('predict error', e);
    } finally {
      sending = false;
    }
  }

  // Render functions for sentence and suggestions
  function renderSentenceArray(arr) {
    // arr: [{word: '...', is_correct: bool, id: '...'}, ...]
    // Render tokens inside sentenceBox and underline incorrect ones
    sentenceBox.innerHTML = '';
    arr.forEach((w, idx) => {
      const span = document.createElement('span');
      span.className = 'word-token' + (w.is_correct ? '' : ' incorrect');
      span.dataset.id = w.id;
      span.textContent = w.word;
      // if incorrect, make it clickable to show suggestions for that token
      if (!w.is_correct) {
        span.style.cursor = 'pointer';
        span.title = 'Click to view suggestions';
        span.addEventListener('click', () => {
          // When clicked, request suggestions for this token from the server if possible
          // Prefer suggestions returned in the last /space response; fallback: request suggestions by sending a temporary space call
          if (lastSuggestions && lastSuggestions.word_id === w.id) {
            renderSuggestionsToAutoBox(lastSuggestions, arr);
          } else {
            // Request suggestions by making a small POST to a backend endpoint is not implemented.
            // As a fallback, ask user to press Space again to re-trigger suggestions for the last word.
            // But we'll still try to render any suggestions present in response mapping.
            if (lastSuggestions && lastSuggestions.word_id) renderSuggestionsToAutoBox(lastSuggestions, arr);
          }
        });
      }
      sentenceBox.appendChild(span);
      // add space between tokens
      if (idx < arr.length - 1) sentenceBox.appendChild(document.createTextNode(' '));
    });
  }

  // Keep the last suggestions object returned by /space so user can click the underlined token
  let lastSuggestions = null;

  function renderSuggestionsToAutoBox(suggestions, sentenceArr) {
    const auto = document.getElementById('autoBox');
    auto.innerHTML = '';
    if (!suggestions) return;
    lastSuggestions = suggestions;
    const wordId = suggestions.word_id;
    const wordObj = sentenceArr.find(x => x.id === wordId) || { word: '' };

    const header = document.createElement('div');
    header.className = 'suggestions-header';
    const title = document.createElement('div');
    title.textContent = `Suggestions for "${wordObj.word}"`;
    header.appendChild(title);
    auto.appendChild(header);

    const content = document.createElement('div');
    content.className = 'suggestions-content';

    const list = document.createElement('div');
    list.className = 'suggestion-list';
    const options = (suggestions.options || []).slice(0, 5);
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'suggestion-btn';
      btn.textContent = opt;
      btn.addEventListener('click', async () => {
        await replaceWord(wordId, opt);
        auto.innerHTML = '';
      });
      list.appendChild(btn);
    });
    content.appendChild(list);

    const ignoreBtn = document.createElement('button');
    ignoreBtn.className = 'suggestion-ignore';
    ignoreBtn.textContent = 'Ignore';
    ignoreBtn.addEventListener('click', async () => {
      await replaceWord(wordId, wordObj.word);
      auto.innerHTML = '';
    });
    content.appendChild(ignoreBtn);
    
    auto.appendChild(content);
  }
  async function replaceWord(wordId, newWord) {
    try {
      const r = await fetch('/replace_word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
        body: JSON.stringify({ word_id: wordId, new_word: newWord })
      });
      const j = await r.json();
      if (j.sentence) renderSentenceArray(j.sentence);
      else if (Array.isArray(j)) renderSentenceArray(j);
    } catch (e) {
      console.error('replace_word error', e);
    }
  }

  // Poll for predictions
  let intervalId = null;

  // Start button: initialize webcam and start prediction
  startBtn.addEventListener('click', async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      webcam.srcObject = stream;
      webcam.play();
      webcam.poster = ''; // Remove poster image

      if (!intervalId) {
        intervalId = setInterval(sendFrameAndUpdate, 125);
      }
      startBtn.style.display = 'none';
      pauseBtn.style.display = 'inline-block';
      showControls();
    } catch (e) {
      alert('Cannot access webcam: ' + e.message);
    }
  });

  // Pause button: stop sending frames and pause video
  pauseBtn.addEventListener('click', () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
      webcam.pause();
      pauseBtn.style.display = 'none';
      resumeBtn.style.display = 'inline-block';
      showControls(true); // Keep controls visible when paused
    }
  });

  // Resume button: start sending frames and play video
  resumeBtn.addEventListener('click', () => {
    if (!intervalId) {
      intervalId = setInterval(sendFrameAndUpdate, 125);
      webcam.play();
      pauseBtn.style.display = 'inline-block';
      resumeBtn.style.display = 'none';
      showControls();
    }
  });
  
  // Controls visibility
  let controlsTimeout;
  function showControls(keepVisible = false) {
    clearTimeout(controlsTimeout);
    videoControls.classList.add('visible');
    if (!keepVisible) {
      controlsTimeout = setTimeout(() => {
        videoControls.classList.remove('visible');
      }, 3000);
    }
  }
  
  videoFeed.addEventListener('click', () => showControls());
  startBtn.addEventListener('click', (e) => { e.stopPropagation(); showControls(); });
  pauseBtn.addEventListener('click', (e) => { e.stopPropagation(); showControls(true); });
  resumeBtn.addEventListener('click', (e) => { e.stopPropagation(); showControls(); });


  // Space button: add word to sentence
  document.getElementById('spaceBtn').addEventListener('click', async () => {
    const r = await fetch('/space', { method: 'POST', headers: { 'X-Session-Id': sessionId }});
    const j = await r.json();
    if (Array.isArray(j.sentence)) {
      renderSentenceArray(j.sentence);
    } else {
      sentenceBox.innerText = j.sentence || "";
    }
    wordsBox.innerText = "";
    // if backend returned suggestions for the last word, render them into autoBox
    if (j.suggestions) renderSuggestionsToAutoBox(j.suggestions, j.sentence || []);
  });
  window.addEventListener('keydown', (e)=> { if (e.key.toLowerCase()==='s') document.getElementById('spaceBtn').click(); });



  // Play/pause audio button
  playBtn.addEventListener('click', async () => {
    try {
      // If audio already loaded, toggle playback
      if (ttsPlayer.src) {
        if (ttsPlayer.paused) {
          await ttsPlayer.play();
          audioName.innerText = 'Playing...';
        } else {
          ttsPlayer.pause();
          audioName.innerText = 'Paused';
        }
        return;
      }

      // Get text from Full Sentence section
      const text = (sentenceBox.innerText || '').trim();
      if (!text) {
        audioName.innerText = 'No sentence to speak';
        return;
      }

      // Request server TTS for the sentence
      audioName.innerText = 'Generating audio...';
      const resp = await fetch('/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': sessionId },
        body: JSON.stringify({ text })
      });
      const j = await resp.json();
      if (j && j.audio_base64) {
        const bytes = atob(j.audio_base64);
        const len = bytes.length;
        const arr = new Uint8Array(len);
        for (let i = 0; i < len; i++) arr[i] = bytes.charCodeAt(i);
        const blob = new Blob([arr], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        ttsPlayer.src = url;
        ttsPlayer.style.display = 'block';
        audioName.innerText = 'Playing...';
        try { await ttsPlayer.play(); } catch (e) { console.warn('autoplay blocked', e); }
      } else if (j && j.audio_file) {
        const url = '/audio/' + encodeURIComponent(j.audio_file);
        ttsPlayer.src = url;
        ttsPlayer.style.display = 'block';
        audioName.innerText = 'Playing...';
        try { await ttsPlayer.play(); } catch (e) { }
      } else {
        audioName.innerText = 'Audio generation failed';
      }
    } catch (e) {
      console.error('play error', e);
      audioName.innerText = 'Audio error';
    }
  });

  // Update UI when audio ends
  ttsPlayer.addEventListener('ended', () => {
    audioName.innerText = 'Playback finished';
  });

  // Clear button: reset all UI and backend state
  document.getElementById('clearBtn').addEventListener('click', async () => {
    await fetch('/clear', { method: 'POST', headers: { 'X-Session-Id': sessionId }});
    wordsBox.innerText = "";
    sentenceBox.innerText = "";
    document.getElementById('autoBox').innerHTML = '';
    audioName.innerText = 'No audio';
    ttsPlayer.pause();
    ttsPlayer.src = '';
  });

  // Delete last predicted sign button
  document.getElementById('deleteLastBtn').addEventListener('click', async () => {
    const r = await fetch('/delete_last', { method: 'POST', headers: { 'X-Session-Id': sessionId }});
    const j = await r.json();
    wordsBox.innerText = j.word || "";
    if (Array.isArray(j.sentence)) renderSentenceArray(j.sentence);
    else sentenceBox.innerText = j.sentence || "";
  });

})();