"use strict";

const pages = [
  {
    title: "繁體演示資料",
    quote: "勞動過程與資本積累。",
    context: "这是 App 截图中用来演示繁简通查的句子。",
    printed: 18, pdf: 1, key: "yuanyinDemo"
  },
  {
    title: "地方史写作练习",
    quote: "地方檔案記載了鄉鎮合作方式的變化。",
    context: "上一段说明了材料的来源，下一段介绍这些记录覆盖的年代。",
    printed: 32, pdf: 39, key: "yuanyinLocal"
  },
  {
    title: "口述访谈练习",
    quote: "访谈中提到的合作方式因季节而异。",
    context: "这段示例文字随后列举了春耕和收获时的两种分工。",
    printed: 47, pdf: 53, key: "yuanyinInterview"
  }
];

const traditional = "勞動過與資積檔記鄉鎮變問異談訪節種筆說檢練習錄頁體";
const simplified = "劳动过与资积档记乡镇变问异谈访节种笔说检练习录页体";
const variants = new Map(Array.from(traditional, (char, index) => [char, simplified[index]]));

const form = document.querySelector("#demo-form");
const query = document.querySelector("#demo-query");
const examples = document.querySelectorAll(".sample");
const status = document.querySelector("#demo-status");
const resultPicker = document.querySelector("#demo-result-picker");
const resultList = document.querySelector("#demo-results");
const source = document.querySelector("#demo-source");
const title = document.querySelector("#demo-source-title");
const printed = document.querySelector("#demo-print-page");
const pdf = document.querySelector("#demo-pdf-page");
const quote = document.querySelector("#demo-quote");
const context = document.querySelector("#demo-context");
const matchLabel = document.querySelector("#demo-match");
const citation = document.querySelector("#demo-citation");
const copy = document.querySelector("#demo-copy");
const copyValue = document.querySelector("#demo-copy-value");
const copyStatus = document.querySelector("#copy-status");
let matches = [];
let current = null;
let copyTimer = 0;

function searchableParts(value) {
  const plain = [];
  const folded = [];
  const offsets = [];
  let offset = 0;
  for (const char of value) {
    for (const normalized of char.normalize("NFKC").toLowerCase()) {
      if (!/[\p{L}\p{N}]/u.test(normalized)) continue;
      plain.push(normalized);
      folded.push(variants.get(normalized) ?? normalized);
      offsets.push([offset, offset + char.length]);
    }
    offset += char.length;
  }
  return { plain, folded, offsets };
}

function exactStart(page, needle) {
  return page.findIndex((_, index) => needle.every((char, step) => page[index + step] === char));
}

function isWithinOneEdit(first, second) {
  if (first.length > second.length) return isWithinOneEdit(second, first);
  if (second.length - first.length > 1) return false;
  const sameLength = first.length === second.length;
  let left = 0;
  let right = 0;
  let differences = 0;
  while (left < first.length && right < second.length) {
    if (first[left] === second[right]) {
      left++;
      right++;
      continue;
    }
    differences++;
    if (differences > 1) return false;
    if (sameLength) left++;
    right++;
  }
  return differences + second.length - right <= 1;
}

function locate(page, needle) {
  const parts = searchableParts(page.quote);
  function match(start, length, type, priority) {
    return {
      page, type, priority,
      start: parts.offsets[start][0],
      end: parts.offsets[start + length - 1][1]
    };
  }
  const exact = exactStart(parts.plain, needle.plain);
  if (exact >= 0) return match(exact, needle.plain.length, "原字匹配", 0);
  const variant = exactStart(parts.folded, needle.folded);
  if (variant >= 0) return match(variant, needle.folded.length, "繁简匹配", 1);
  if (needle.folded.length < 4) return null;
  for (const length of [needle.folded.length, needle.folded.length + 1, needle.folded.length - 1]) {
    for (let start = 0; start + length <= parts.folded.length; start++) {
      if (isWithinOneEdit(parts.folded.slice(start, start + length), needle.folded)) {
        return match(start, length, "近似候选", 2);
      }
    }
  }
  return null;
}

function render(result) {
  current = result;
  clearTimeout(copyTimer);
  copy.textContent = "复制引文";
  copyValue.hidden = true;
  copyStatus.textContent = "";
  source.hidden = !result;
  copy.hidden = !result;
  citation.hidden = !result;
  quote.replaceChildren();

  if (!result) {
    matchLabel.textContent = "";
    quote.textContent = "没有找到匹配的原句";
    context.textContent = "可以试试上面的示例，或改用记得的几个字。";
    return;
  }

  const { page, type, start, end } = result;
  const highlighted = document.createElement("mark");
  highlighted.textContent = page.quote.slice(start, end);
  quote.append(page.quote.slice(0, start), highlighted, page.quote.slice(end));
  matchLabel.textContent = type;
  title.textContent = page.title;
  printed.textContent = String(page.printed);
  pdf.textContent = String(page.pdf);
  context.textContent = page.context;
  citation.textContent = `[@${page.key}, p. ${page.printed}]`;
}

function search() {
  const needle = searchableParts(query.value);
  matches = needle.plain.length ? pages
    .map(page => locate(page, needle))
    .filter(Boolean)
    .sort((first, second) => first.priority - second.priority) : [];

  status.textContent = matches.length === 1
    ? `找到 1 条 · ${matches[0].type}`
    : `找到 ${matches.length} 条`;
  resultPicker.hidden = matches.length < 2;
  resultList.replaceChildren(...matches.map(({page}, index) => new Option(page.title, String(index))));
  examples.forEach(example => example.setAttribute("aria-pressed", String(example.dataset.query === query.value)));
  render(matches[0] ?? null);
}

form.addEventListener("submit", event => {
  event.preventDefault();
  search();
});
examples.forEach(example => example.addEventListener("click", () => {
  query.value = example.dataset.query;
  search();
}));
resultList.addEventListener("change", () => render(matches[Number(resultList.value)] ?? null));
copy.addEventListener("click", async () => {
  if (!current) return;
  const result = current;
  const value = `${result.page.quote} ${citation.textContent}`;
  try {
    await navigator.clipboard.writeText(value);
    if (current !== result) return;
    copyValue.hidden = true;
    copy.textContent = "已复制";
    copyStatus.textContent = "已复制原句和引文键。";
  } catch {
    if (current !== result) return;
    copyValue.value = value;
    copyValue.hidden = false;
    copyValue.focus();
    copyValue.select();
    copy.textContent = "请手动复制";
    copyStatus.textContent = "浏览器未能写入剪贴板。已选中示例文字，请使用系统复制快捷键。";
  }
  clearTimeout(copyTimer);
  copyTimer = setTimeout(() => { copy.textContent = "复制引文"; }, 2600);
});

search();
