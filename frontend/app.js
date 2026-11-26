"use strict";

const API_STORAGE_KEY = "studyroom-api-url";
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const initialApiUrl = window.location.protocol === "file:"
  ? "http://127.0.0.1:8000"
  : localHosts.has(window.location.hostname)
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : window.location.origin;

const apiInput = document.getElementById("api-url");
const connectionIndicator = document.getElementById("connection-indicator");
const checkConnectionButton = document.getElementById("check-connection");

apiInput.value = localStorage.getItem(API_STORAGE_KEY) || initialApiUrl;

function setConnectionStatus(status) {
  connectionIndicator.classList.remove("is-online", "is-offline");
  if (status === "online") connectionIndicator.classList.add("is-online");
  if (status === "offline") connectionIndicator.classList.add("is-offline");
}

function getApiBase() {
  const rawUrl = apiInput.value.trim();
  if (!rawUrl) throw new Error("Enter the base URL for your FastAPI server.");

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Enter a valid API URL, for example http://127.0.0.1:8000.");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("The API URL must start with http:// or https://.");
  }
  return url.origin;
}

async function requestApi(path, payload) {
  const baseUrl = getApiBase();
  const options = payload === undefined
    ? { method: "GET" }
    : {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      };

  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, options);
  } catch {
    throw new Error(`Could not reach ${baseUrl}. Check that the backend is running and allows requests from this frontend's origin.`);
  }

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = typeof body.detail === "string" ? body.detail : "";
    } catch {
      // Use the HTTP status when the server does not return a JSON error body.
    }
    if (response.status === 401) throw new Error(detail || "The API key is not authenticated. Check the backend configuration.");
    if (response.status === 429) throw new Error(detail || "The service is receiving too many requests. Please try again later.");
    if (response.status === 422) throw new Error(detail || "Some form values are not accepted. Check the fields and try again.");
    throw new Error(detail || `The API request failed with status ${response.status}.`);
  }

  setConnectionStatus("online");
  return response.json();
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function renderError(container, error) {
  container.replaceChildren(makeElement("p", "error-message", error.message || "Something went wrong. Please try again."));
  container.setAttribute("tabindex", "-1");
  container.focus({ preventScroll: true });
}

function showLoading(container, message) {
  container.replaceChildren(makeElement("p", "loading-message", message));
}

function setBusy(form, busy, label) {
  const button = form.querySelector("button[type='submit']");
  button.disabled = busy;
  button.querySelector("span:first-child").textContent = busy ? "One moment…" : label;
}

function getFormPayload(form, integerFields = []) {
  const payload = Object.fromEntries(new FormData(form).entries());
  integerFields.forEach((field) => {
    payload[field] = Number(payload[field]);
  });
  return payload;
}

const chatForm = document.getElementById("chat-form");
if (chatForm) chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const thread = document.getElementById("chat-thread");
  const input = document.getElementById("chat-message");
  const message = input.value.trim();
  if (!message) return;

  document.getElementById("chat-empty")?.remove();
  appendChatMessage(thread, "user", message);
  const pendingMessage = appendChatMessage(thread, "assistant", "Thinking through your question…");
  pendingMessage.row.classList.add("is-loading");
  thread.setAttribute("aria-busy", "true");
  const submitLabel = "Send";
  setBusy(form, true, submitLabel);
  input.disabled = true;
  scrollChatToLatest(thread);

  try {
    const data = await requestApi("/chat/", { message });
    pendingMessage.row.classList.remove("is-loading");
    const markdown = makeElement("div", "chat-markdown");
    renderMarkdown(markdown, data.msg);
    pendingMessage.text.replaceWith(markdown);
    if (containsMathNotation(data.msg)) {
      try {
        const rendered = await typesetMath(markdown);
        if (!rendered) appendMathWarning(pendingMessage.content);
      } catch {
        appendMathWarning(pendingMessage.content);
      }
    }
    if (data.model || data.tokens) {
      const details = [data.model, Number.isFinite(data.tokens) ? `${data.tokens} tokens` : ""].filter(Boolean).join(" · ");
      pendingMessage.content.append(makeElement("p", "chat-message-meta", details));
    }
    form.reset();
    input.style.height = "";
  } catch (error) {
    setConnectionStatus("offline");
    pendingMessage.row.classList.remove("is-loading");
    pendingMessage.row.classList.add("is-error");
    pendingMessage.text.textContent = error.message || "Something went wrong. Please try again.";
  } finally {
    setBusy(form, false, submitLabel);
    input.disabled = false;
    thread.removeAttribute("aria-busy");
    input.focus();
    scrollChatToLatest(thread);
  }
});

function appendChatMessage(thread, role, message) {
  const row = makeElement("article", `chat-message ${role}`);
  const avatar = makeElement("span", "chat-message-avatar", role === "user" ? "Y" : "s");
  avatar.setAttribute("aria-hidden", "true");
  const content = makeElement("div", "chat-message-content");
  const label = makeElement("p", "chat-message-label", role === "user" ? "You" : "Studyroom assistant");
  const bubble = makeElement("div", "chat-bubble");
  const text = makeElement("p", "chat-message-text", message);
  bubble.append(text);
  content.append(label, bubble);
  row.append(avatar, content);
  thread.append(row);
  return { row, content, text };
}

function renderMarkdown(container, markdown) {
  container.replaceChildren();
  const lines = String(markdown ?? "").replace(/\r\n?/g, "\n").split("\n");
  let paragraph = [];
  let list = null;
  let listType = "";
  let quote = [];
  let code = null;

  function flushParagraph() {
    if (!paragraph.length) return;
    const element = document.createElement("p");
    appendInlineMarkdown(element, paragraph.join(" "));
    container.append(element);
    paragraph = [];
  }

  function flushList() {
    if (!list) return;
    container.append(list);
    list = null;
    listType = "";
  }

  function flushQuote() {
    if (!quote.length) return;
    const element = document.createElement("blockquote");
    const text = document.createElement("p");
    appendInlineMarkdown(text, quote.join(" "));
    element.append(text);
    container.append(element);
    quote = [];
  }

  function flushCode() {
    const pre = document.createElement("pre");
    const codeElement = document.createElement("code");
    codeElement.textContent = code.join("\n");
    pre.append(codeElement);
    container.append(pre);
    code = null;
  }

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];

    if (code !== null) {
      if (/^```/.test(line)) flushCode();
      else code.push(line);
      continue;
    }

    if (/^```/.test(line)) {
      flushParagraph();
      flushList();
      flushQuote();
      code = [];
      continue;
    }

    const table = parseMarkdownTable(lines, lineIndex);
    if (table) {
      flushParagraph();
      flushList();
      flushQuote();
      container.append(table.element);
      lineIndex += table.lineCount - 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flushParagraph();
      flushList();
      flushQuote();
      const element = document.createElement(`h${heading[1].length}`);
      appendInlineMarkdown(element, heading[2]);
      container.append(element);
      continue;
    }

    if (/^\s*(?:(?:-{3,})|(?:\*{3,})|(?:_{3,}))\s*$/.test(line)) {
      flushParagraph();
      flushList();
      flushQuote();
      container.append(document.createElement("hr"));
      continue;
    }

    const quoted = line.match(/^\s*>\s?(.*)$/);
    if (quoted) {
      flushParagraph();
      flushList();
      quote.push(quoted[1]);
      continue;
    }
    flushQuote();

    const listItem = line.match(/^\s*(?:([-+*])|(\d+)[.)])\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      const nextListType = listItem[2] ? "ol" : "ul";
      if (list && listType !== nextListType) flushList();
      if (!list) {
        listType = nextListType;
        list = document.createElement(listType);
        if (listType === "ol" && Number(listItem[2]) !== 1) {
          list.start = Number(listItem[2]);
        }
      }
      const item = document.createElement("li");
      appendInlineMarkdown(item, listItem[3]);
      list.append(item);
      continue;
    }

    flushList();
    if (!line.trim()) flushParagraph();
    else paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  flushQuote();
  if (code !== null) flushCode();
}

function splitMarkdownTableRow(line) {
  let content = line.trim();
  if (content.startsWith("|")) content = content.slice(1);
  if (content.endsWith("|")) content = content.slice(0, -1);
  return content.split("|").map((cell) => cell.trim());
}

function isMarkdownTableSeparator(line) {
  const cells = splitMarkdownTableRow(line);
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function buildMarkdownTable(headers, separators, rows) {
  const wrapper = makeElement("div", "markdown-table-wrap");
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");

  headers.forEach((value, index) => {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.style.textAlign = getTableAlignment(separators[index]);
    appendInlineMarkdown(cell, value);
    headRow.append(cell);
  });
  head.append(headRow);

  const body = document.createElement("tbody");
  rows.forEach((row) => {
    const tableRow = document.createElement("tr");
    headers.forEach((_, index) => {
      const cell = document.createElement("td");
      cell.style.textAlign = getTableAlignment(separators[index]);
      appendInlineMarkdown(cell, row[index] ?? "");
      tableRow.append(cell);
    });
    body.append(tableRow);
  });

  table.append(head, body);
  wrapper.append(table);
  return wrapper;
}

function getTableAlignment(separator = "") {
  const leftAligned = separator.startsWith(":");
  const rightAligned = separator.endsWith(":");
  if (leftAligned && rightAligned) return "center";
  if (rightAligned) return "right";
  return "left";
}

function parseMarkdownTable(lines, index) {
  const line = lines[index];
  if (!line.includes("|")) return null;

  if (lines[index + 1] && isMarkdownTableSeparator(lines[index + 1])) {
    const headers = splitMarkdownTableRow(line);
    const separators = splitMarkdownTableRow(lines[index + 1]);
    if (headers.length !== separators.length) return null;

    const rows = [];
    let nextLine = index + 2;
    while (nextLine < lines.length && lines[nextLine].trim() && lines[nextLine].includes("|")) {
      rows.push(splitMarkdownTableRow(lines[nextLine]));
      nextLine += 1;
    }
    return {
      element: buildMarkdownTable(headers, separators, rows),
      lineCount: nextLine - index
    };
  }

  const collapsedSeparator = /\|\s*:?-{3,}:?\s*\|(?:\s*:?-{3,}:?\s*\|)+/.exec(line);
  if (!collapsedSeparator) return null;

  const headerLine = line.slice(0, collapsedSeparator.index);
  const headers = splitMarkdownTableRow(headerLine);
  const separators = splitMarkdownTableRow(collapsedSeparator[0]);
  if (headers.length !== separators.length) return null;

  const bodyLine = line.slice(collapsedSeparator.index + collapsedSeparator[0].length);
  const rows = bodyLine
    .split(/\s*\|\s*\|\s*/)
    .map((row) => splitMarkdownTableRow(row))
    .filter((row) => row.length === headers.length && row.some(Boolean));

  return {
    element: buildMarkdownTable(headers, separators, rows),
    lineCount: 1
  };
}

function containsMathNotation(text) {
  return text.includes("$") || text.includes("\\(") || text.includes("\\[");
}

async function typesetMath(element) {
  const mathJax = window.MathJax;
  if (mathJax?.startup?.promise) await mathJax.startup.promise;
  if (typeof mathJax?.typesetPromise !== "function") return false;
  await mathJax.typesetPromise([element]);
  return true;
}

function appendMathWarning(container) {
  container.append(makeElement("p", "math-render-warning", "Math formatting is unavailable; showing the original notation."));
}

function appendInlineMarkdown(parent, text, depth = 0) {
  if (depth > 4) {
    parent.append(document.createTextNode(text));
    return;
  }

  const tokenPattern = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)|\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`|\*(.+?)\*|_([^_]+)_|~~(.+?)~~/g;
  let previousIndex = 0;
  let token;

  while ((token = tokenPattern.exec(text)) !== null) {
    if (token.index > previousIndex) {
      parent.append(document.createTextNode(text.slice(previousIndex, token.index)));
    }

    if (token[1] !== undefined) {
      let url;
      try {
        url = new URL(token[2], window.location.href);
      } catch {
        url = null;
      }
      if (url && ["http:", "https:", "mailto:"].includes(url.protocol)) {
        const link = document.createElement("a");
        link.href = url.href;
        if (token[3]) link.title = token[3];
        appendInlineMarkdown(link, token[1], depth + 1);
        parent.append(link);
      } else {
        parent.append(document.createTextNode(token[0]));
      }
    } else if (token[4] !== undefined || token[5] !== undefined) {
      const strong = document.createElement("strong");
      appendInlineMarkdown(strong, token[4] ?? token[5], depth + 1);
      parent.append(strong);
    } else if (token[6] !== undefined) {
      parent.append(makeElement("code", "", token[6]));
    } else if (token[7] !== undefined || token[8] !== undefined) {
      const emphasis = document.createElement("em");
      appendInlineMarkdown(emphasis, token[7] ?? token[8], depth + 1);
      parent.append(emphasis);
    } else if (token[9] !== undefined) {
      const deletion = document.createElement("del");
      appendInlineMarkdown(deletion, token[9], depth + 1);
      parent.append(deletion);
    }

    previousIndex = tokenPattern.lastIndex;
  }

  if (previousIndex < text.length) {
    parent.append(document.createTextNode(text.slice(previousIndex)));
  }
}

function scrollChatToLatest(thread) {
  thread.scrollTo({
    top: thread.scrollHeight,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
  });
}

const chatMessageInput = document.getElementById("chat-message");
if (chatMessageInput) {
  chatMessageInput.addEventListener("input", () => {
    chatMessageInput.style.height = "auto";
    chatMessageInput.style.height = `${Math.min(chatMessageInput.scrollHeight, 140)}px`;
  });

  chatMessageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      chatForm.requestSubmit();
    }
  });
}

document.querySelectorAll(".chat-suggestion").forEach((suggestion) => {
  suggestion.addEventListener("click", () => {
    chatMessageInput.value = suggestion.dataset.prompt;
    chatMessageInput.focus();
    chatMessageInput.dispatchEvent(new Event("input"));
  });
});

function renderQuiz(container, data) {
  const title = makeElement("div", "response-card");
  title.append(
    makeElement("p", "response-label", "YOUR PRACTICE QUIZ"),
    makeElement("p", "response-text", `A quiz about ${data.topic}`)
  );
  const list = makeElement("div", "quiz-list");

  data.questions.forEach((question, questionIndex) => {
    const item = makeElement("section", "quiz-question");
    item.setAttribute("aria-labelledby", `quiz-question-${questionIndex}`);
    item.append(makeElement("h4", "", `${questionIndex + 1}. ${question.question}`));
    item.querySelector("h4").id = `quiz-question-${questionIndex}`;

    const options = makeElement("div", "quiz-options");
    options.setAttribute("role", "group");
    options.setAttribute("aria-label", `Answers for question ${questionIndex + 1}`);
    let answered = false;

    question.options.forEach((option, optionIndex) => {
      const button = makeElement("button", "quiz-option");
      button.type = "button";
      button.append(makeElement("span", "option-letter", String.fromCharCode(65 + optionIndex)));
      button.append(makeElement("span", "", option));
      button.addEventListener("click", () => {
        if (answered) return;
        answered = true;
        const isCorrect = optionIndex === question.correct;
        options.querySelectorAll("button").forEach((answerButton, index) => {
          answerButton.disabled = true;
          if (index === question.correct) answerButton.classList.add("is-correct");
          else if (index === optionIndex && !isCorrect) answerButton.classList.add("is-incorrect");
        });
        feedback.textContent = isCorrect ? "That’s right. Nice work!" : `Not quite. The correct answer is ${question.options[question.correct]}.`;
        feedback.className = `quiz-feedback ${isCorrect ? "is-correct" : "is-incorrect"}`;
      });
      options.append(button);
    });

    const feedback = makeElement("p", "quiz-feedback", "Choose an answer to check your understanding.");
    feedback.setAttribute("aria-live", "polite");
    item.append(options, feedback);
    list.append(item);
  });

  container.replaceChildren(title, list);
  container.setAttribute("tabindex", "-1");
  container.focus({ preventScroll: true });
}

const quizForm = document.getElementById("quiz-form");
if (quizForm) quizForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const result = document.getElementById("quiz-result");
  const submitLabel = "Build my quiz";
  setBusy(form, true, submitLabel);
  showLoading(result, "Putting your practice quiz together…");

  try {
    const payload = getFormPayload(form, ["number_questions", "number_options"]);
    const data = await requestApi("/quizz/", payload);
    renderQuiz(result, data);
  } catch (error) {
    setConnectionStatus("offline");
    renderError(result, error);
  } finally {
    setBusy(form, false, submitLabel);
  }
});

function renderFlashcards(container, data) {
  if (!Array.isArray(data.flashcards) || data.flashcards.length === 0) {
    container.replaceChildren(makeElement("p", "error-message", "No flashcards came back. Try another topic."));
    return;
  }

  let index = 0;
  let showingAnswer = false;
  const card = makeElement("button", "flashcard");
  card.type = "button";
  const content = makeElement("span", "flashcard-content");
  const label = makeElement("span", "flashcard-label");
  const text = makeElement("span", "flashcard-text");
  content.append(label, text);
  card.append(content);
  card.setAttribute("aria-label", "Flashcard. Activate to reveal the answer.");

  const controls = makeElement("div", "flashcard-controls");
  const previous = makeElement("button", "", "Previous");
  previous.type = "button";
  const count = makeElement("span", "flashcard-count");
  count.setAttribute("aria-live", "polite");
  const next = makeElement("button", "", "Next");
  next.type = "button";
  controls.append(previous, count, next);

  function updateCard() {
    const activeCard = data.flashcards[index];
    label.textContent = showingAnswer ? "ANSWER · TAP TO FLIP BACK" : "QUESTION · TAP TO REVEAL";
    text.textContent = showingAnswer ? activeCard.answer : activeCard.question;
    count.textContent = `${index + 1} of ${data.flashcards.length}`;
    previous.disabled = index === 0;
    next.disabled = index === data.flashcards.length - 1;
    card.classList.toggle("is-flipped", showingAnswer);
  }

  card.addEventListener("click", () => {
    showingAnswer = !showingAnswer;
    updateCard();
  });
  previous.addEventListener("click", () => {
    if (index === 0) return;
    index -= 1;
    showingAnswer = false;
    updateCard();
    card.focus();
  });
  next.addEventListener("click", () => {
    if (index === data.flashcards.length - 1) return;
    index += 1;
    showingAnswer = false;
    updateCard();
    card.focus();
  });

  updateCard();
  const heading = makeElement("div", "response-card");
  heading.append(
    makeElement("p", "response-label", "YOUR FLASHCARDS"),
    makeElement("p", "response-text", `Review ${data.topic} at your own pace.`)
  );
  const stage = makeElement("div", "flashcard-stage");
  stage.append(card, controls);
  container.replaceChildren(heading, stage);
  container.setAttribute("tabindex", "-1");
  container.focus({ preventScroll: true });
}

const flashcardsForm = document.getElementById("flashcards-form");
if (flashcardsForm) flashcardsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const result = document.getElementById("flashcards-result");
  const submitLabel = "Create flashcards";
  setBusy(form, true, submitLabel);
  showLoading(result, "Making your flashcards…");

  try {
    const payload = getFormPayload(form, ["number"]);
    const data = await requestApi("/flashcard/", payload);
    renderFlashcards(result, data);
  } catch (error) {
    setConnectionStatus("offline");
    renderError(result, error);
  } finally {
    setBusy(form, false, submitLabel);
  }
});

checkConnectionButton.addEventListener("click", async () => {
  checkConnectionButton.disabled = true;
  setConnectionStatus("checking");
  try {
    await requestApi("/health");
    setConnectionStatus("online");
  } catch (error) {
    setConnectionStatus("offline");
    const result = document.querySelector(".result-area");
    renderError(result, error);
  } finally {
    checkConnectionButton.disabled = false;
  }
});

apiInput.addEventListener("change", () => {
  try {
    const baseUrl = getApiBase();
    apiInput.value = baseUrl;
    localStorage.setItem(API_STORAGE_KEY, baseUrl);
    setConnectionStatus("checking");
  } catch (error) {
    setConnectionStatus("offline");
    renderError(document.querySelector(".result-area"), error);
  }
});
