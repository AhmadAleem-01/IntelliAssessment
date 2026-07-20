import { useEffect, useRef, useState } from 'react';
import { makeStyles, Tooltip } from '@fluentui/react-components';
import {
  TextBold16Regular,
  TextItalic16Regular,
  TextUnderline16Regular,
  TextAlignLeft16Regular,
  TextAlignCenter16Regular,
  TextAlignRight16Regular,
  TextBulletList16Regular,
  TextNumberListLtr16Regular,
} from '@fluentui/react-icons';
import { sanitizeHtml, looksLikeHtml } from './sanitizeHtml';

/**
 * Rich-text content-editable field for the letter builder's text / heading /
 * signature blocks. Supports bold / italic / underline, a small font-size set,
 * font colour, paragraph alignment, and bullet / numbered lists — plus inline
 * **answer chips** (`<span class="tok-chip" data-level>`) inserted from the
 * "Insert answer" picker.
 *
 * ## Storage
 * The block's value is now sanitized **HTML** (was a plain token string). On
 * every input we serialize `el.innerHTML` through the allowlist sanitizer and
 * emit it. Legacy plain-text values (with `{{q:}}` tokens) are migrated to HTML
 * on load. We render from the model only when `value` changes from outside
 * (never mid-type) so the caret is never reset.
 *
 * ## Formatting mechanism
 * Uses `document.execCommand` — still the pragmatic API for contentEditable rich
 * text. Browsers emit legacy `<font>` tags for size/colour; `normalizeFont`
 * rewrites those to styled `<span>`s (which the sanitizer allows) after each
 * command.
 */

const FONT_SIZES: { label: string; px: number }[] = [
  { label: 'Small', px: 11 },
  { label: 'Normal', px: 13 },
  { label: 'Large', px: 16 },
  { label: 'X-Large', px: 20 },
];

// Text colours offered in the toolbar: black (default) + brand purple, then
// the four primaries the author asked for — blue, green, red, yellow.
const COLORS: { hex: string; name: string }[] = [
  { hex: '#1a1a1a', name: 'Black' },
  { hex: '#7F77DD', name: 'Purple' },
  { hex: '#1c5aa8', name: 'Blue' },
  { hex: '#2e7d32', name: 'Green' },
  { hex: '#d32f2f', name: 'Red' },
  { hex: '#f2b705', name: 'Yellow' },
];

const useStyles = makeStyles({
  wrap: { display: 'flex', flexDirection: 'column', gap: '4px' },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '2px',
    padding: '2px',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--color-background-secondary)',
  },
  tbBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '26px',
    height: '26px',
    border: 'none',
    background: 'transparent',
    borderRadius: 'var(--border-radius-sm)',
    color: 'var(--color-text-secondary)',
    cursor: 'pointer',
    padding: 0,
    ':hover': { backgroundColor: 'var(--color-background-tertiary)', color: 'var(--color-text-primary)' },
  },
  sizeSelect: {
    height: '26px',
    border: 'none',
    background: 'transparent',
    color: 'var(--color-text-secondary)',
    fontSize: '12px',
    cursor: 'pointer',
    borderRadius: 'var(--border-radius-sm)',
    ':hover': { backgroundColor: 'var(--color-background-tertiary)' },
  },
  swatch: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '1px solid rgba(0,0,0,0.15)',
    cursor: 'pointer',
    padding: 0,
    margin: '0 1px',
  },
  divider: {
    width: '1px',
    height: '18px',
    backgroundColor: 'var(--color-border-tertiary)',
    margin: '0 3px',
  },
  editor: {
    minHeight: '48px',
    padding: '7px 10px',
    border: '1px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-md)',
    backgroundColor: 'var(--color-background-primary)',
    fontSize: '13px',
    lineHeight: 1.7,
    color: 'var(--color-text-primary)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    outline: 'none',
    cursor: 'text',
    ':focus': { border: '1px solid var(--color-purple)' },
    ':empty::before': {
      content: 'attr(data-placeholder)',
      color: 'var(--color-text-tertiary)',
    },
  },
  editorHost: { position: 'relative' },
  slashMenu: {
    position: 'absolute',
    zIndex: 30,
    minWidth: '200px',
    maxWidth: '280px',
    maxHeight: '220px',
    overflow: 'auto',
    backgroundColor: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 'var(--border-radius-md)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
    padding: '4px',
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
  },
  slashItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '1px',
    width: '100%',
    textAlign: 'left',
    border: 'none',
    background: 'transparent',
    padding: '6px 8px',
    borderRadius: 'var(--border-radius-sm)',
    cursor: 'pointer',
    color: 'var(--color-text-primary)',
  },
  slashItemActive: { backgroundColor: 'var(--color-purple-soft)' },
  slashItemLabel: { fontSize: '13px', fontWeight: 500 },
  slashItemPath: { fontSize: '10px', color: 'var(--color-text-tertiary)' },
});

/** Zero-width space — an invisible, non-collapsing caret landing spot inserted
 *  after an atomic chip so the user can type to its right. Stripped on save. */
const ZWSP = String.fromCharCode(0x200b);

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;');
}
function chipHtml(levelId: string, name: string): string {
  return (
    `<span class="tok-chip" contenteditable="false" data-level="${escapeAttr(levelId)}">` +
    `${escapeHtml(name || 'answer')}</span>`
  );
}

const LEGACY_TOKEN_REGEX = /\{\{q:([^|}]+)\|([^}]*)\}\}/g;

/** Migrate a legacy plain-text value (with {{q:}} tokens) to editor HTML. */
function legacyToHtml(raw: string): string {
  let out = '';
  let last = 0;
  for (const m of raw.matchAll(LEGACY_TOKEN_REGEX)) {
    out += escapeHtml(raw.slice(last, m.index));
    out += chipHtml(m[1], m[2]);
    last = m.index + m[0].length;
  }
  out += escapeHtml(raw.slice(last));
  return out.replace(/\n/g, '<br>');
}

/** Value → editor HTML (sanitized). HTML passes through; plain text migrates. */
function toEditorHtml(value: string): string {
  const html = looksLikeHtml(value) ? value : legacyToHtml(value);
  return sanitizeHtml(html);
}

/** Rewrite browser-emitted <font size|color> into allowlisted styled spans. */
function normalizeFont(root: HTMLElement): void {
  root.querySelectorAll('font').forEach((f) => {
    const span = document.createElement('span');
    const size = f.getAttribute('size');
    const color = f.getAttribute('color');
    const styles: string[] = [];
    if (color) styles.push(`color: ${color}`);
    // Legacy size buckets 1..7 → our px scale (only used as a transient step;
    // the size dropdown sets px directly, but paste can still yield <font>).
    if (size) {
      const map: Record<string, number> = { '1': 11, '2': 12, '3': 13, '4': 16, '5': 20, '6': 24, '7': 28 };
      const px = map[size];
      if (px) styles.push(`font-size: ${px}px`);
    }
    if (styles.length) span.setAttribute('style', styles.join('; '));
    while (f.firstChild) span.appendChild(f.firstChild);
    f.replaceWith(span);
  });
}

interface TokenTextEditorHandle {
  insertToken: (levelId: string, name: string) => void;
}

/** A question the slash menu / picker can insert. */
export interface QuestionOption {
  levelId: string;
  label: string;
  path: string;
}

interface Props {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Single-line (heading): Enter suppressed, lists/align hidden. */
  singleLine?: boolean;
  handleRef?: (h: TokenTextEditorHandle | null) => void;
  /** Questions offered by the inline "/" slash menu. */
  questionOptions?: QuestionOption[];
}

interface SlashState {
  /** Chars typed after "/" (the live filter). */
  query: string;
  /** Highlighted option index. */
  index: number;
  /** Menu anchor position, viewport coords. */
  top: number;
  left: number;
}

export function TokenTextEditor({
  value,
  onChange,
  placeholder,
  singleLine,
  handleRef,
  questionOptions = [],
}: Props) {
  const styles = useStyles();
  const ref = useRef<HTMLDivElement | null>(null);
  const lastEmitted = useRef<string>(value);
  // Last known caret range INSIDE the editor. Saved on selection changes so a
  // toolbar/picker click (which moves focus out) can restore where to insert.
  const savedRange = useRef<Range | null>(null);
  const [slash, setSlash] = useState<SlashState | null>(null);

  // DOM ← model only on external change (never mid-type).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value === lastEmitted.current) return;
    el.innerHTML = toEditorHtml(value);
    lastEmitted.current = value;
    placeCaretAtEnd(el);
  }, [value]);

  useEffect(() => {
    const el = ref.current;
    if (el) el.innerHTML = toEditorHtml(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // insertChip is defined below; a ref lets the imperative handle call the
  // latest version without a render-time forward reference (react-hooks rule).
  const insertChipRef = useRef<(levelId: string, name: string) => void>(() => {});
  useEffect(() => {
    if (!handleRef) return;
    handleRef({ insertToken: (levelId, name) => insertChipRef.current(levelId, name) });
    return () => handleRef(null);
  }, [handleRef]);

  // Track the caret whenever it moves inside the editor, so an out-of-editor
  // click (toolbar / picker) can still insert at the right spot.
  function saveSelection() {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (el.contains(range.commonAncestorContainer)) {
      savedRange.current = range.cloneRange();
    }
  }

  function restoreSelection() {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    } else {
      placeCaretAtEnd(el);
    }
  }

  /** Insert an answer chip at the saved caret (used by picker + slash menu). */
  function insertChip(levelId: string, name: string) {
    const el = ref.current;
    if (!el) return;
    restoreSelection();
    insertHtmlAtCaret(el, chipHtml(levelId, name) + ZWSP);
    saveSelection();
    emit();
  }
  // Keep the imperative handle pointing at the latest insertChip closure
  // (ref written in an effect, not during render — react-hooks/refs).
  useEffect(() => {
    insertChipRef.current = insertChip;
  });

  function emit() {
    const el = ref.current;
    if (!el) return;
    normalizeFont(el);
    // Strip the zero-width caret-spacers before storing so they don't
    // accumulate in the saved HTML / leak into the rendered letter.
    const html = sanitizeHtml(el.innerHTML).split(ZWSP).join('');
    lastEmitted.current = html;
    onChange(html);
  }

  /** Whether there's a non-empty selection inside the editor right now. */
  function hasSelection(): boolean {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
    return el.contains(sel.getRangeAt(0).commonAncestorContainer);
  }

  /** Run an execCommand against the current selection, then re-emit. */
  function exec(command: string, value?: string) {
    ref.current?.focus();
    document.execCommand(command, false, value);
    emit();
  }

  /**
   * Colour the selection. `foreColor` in contentEditable can only reliably
   * colour an ACTIVE selection — with a collapsed caret it tries to "arm" the
   * next keystroke, which mis-attaches to the wrong character (the reported
   * bug). So we no-op unless text is selected. Answer chips inside the
   * selection get their inline `color` set directly, since their `.tok-chip`
   * class colour would otherwise win over the browser-inserted span.
   */
  function applyColor(hex: string) {
    if (!hasSelection()) return;
    const el = ref.current!;
    el.focus();
    // Capture the chips the selection touches BEFORE execCommand runs — it
    // collapses/moves the range, so reading it afterwards misses them.
    const chips = chipsInSelection(el);
    document.execCommand('foreColor', false, hex);
    // Inline colour on the chip beats its `.tok-chip` class default, and is
    // preserved through save + carried into the rendered letter.
    chips.forEach((chip) => {
      chip.style.color = hex;
    });
    emit();
  }

  /**
   * Apply a px font-size to the SELECTION by wrapping it in a styled span.
   * Like colour, needs an active selection (arming next-typing is unreliable).
   */
  function applyFontSize(px: number) {
    if (!hasSelection()) return;
    const el = ref.current!;
    el.focus();
    // execCommand fontSize needs 1..7; use a sentinel size then rewrite the
    // emitted <font> to our exact px. 7 is unlikely to appear naturally.
    document.execCommand('fontSize', false, '7');
    el.querySelectorAll('font[size="7"]').forEach((f) => {
      const span = document.createElement('span');
      span.setAttribute('style', `font-size: ${px}px`);
      while (f.firstChild) span.appendChild(f.firstChild);
      f.replaceWith(span);
    });
    emit();
  }

  // --- slash menu ----------------------------------------------------------
  // Options filtered by the live query typed after "/". Capped so a long
  // template's question list stays a tidy menu.
  const slashMatches =
    slash === null
      ? []
      : questionOptions
          .filter((q) =>
            q.label.toLowerCase().includes(slash.query.toLowerCase()),
          )
          .slice(0, 8);

  /**
   * After each input, look at the text immediately before the caret. If it's a
   * "/" (optionally followed by word chars, no spaces) treat it as an open
   * slash trigger and (re)position the menu; otherwise close it.
   */
  function detectSlash() {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) {
      setSlash(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE || !el.contains(node)) {
      setSlash(null);
      return;
    }
    const textBefore = (node.textContent ?? '').slice(0, range.startOffset);
    const m = /\/([^\s/]*)$/.exec(textBefore);
    if (!m) {
      setSlash(null);
      return;
    }
    // Anchor the menu just below the caret.
    const rect = range.getBoundingClientRect();
    const host = el.getBoundingClientRect();
    setSlash({
      query: m[1],
      index: 0,
      top: rect.bottom - host.top + 4,
      left: rect.left - host.left,
    });
  }

  /** Delete the "/query" run just before the caret (before inserting a chip). */
  function deleteSlashQuery(queryLen: number) {
    const el = ref.current;
    const sel = window.getSelection();
    if (!el || !sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const start = Math.max(0, range.startOffset - (queryLen + 1)); // +1 for "/"
    range.setStart(range.startContainer, start);
    range.deleteContents();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function chooseSlash(opt: QuestionOption) {
    deleteSlashQuery(slash?.query.length ?? 0);
    setSlash(null);
    insertHtmlAtCaret(ref.current!, chipHtml(opt.levelId, opt.label) + ZWSP);
    saveSelection();
    emit();
  }

  function onEditorKeyDown(e: React.KeyboardEvent) {
    if (slash) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlash((s) => (s ? { ...s, index: Math.min(s.index + 1, slashMatches.length - 1) } : s));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlash((s) => (s ? { ...s, index: Math.max(s.index - 1, 0) } : s));
        return;
      }
      if (e.key === 'Enter') {
        if (slashMatches[slash.index]) {
          e.preventDefault();
          chooseSlash(slashMatches[slash.index]);
          return;
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSlash(null);
        return;
      }
    }
    if (singleLine && e.key === 'Enter') e.preventDefault();
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <ToolbarBtn styles={styles} label="Bold" onClick={() => exec('bold')}>
          <TextBold16Regular />
        </ToolbarBtn>
        <ToolbarBtn styles={styles} label="Italic" onClick={() => exec('italic')}>
          <TextItalic16Regular />
        </ToolbarBtn>
        <ToolbarBtn styles={styles} label="Underline" onClick={() => exec('underline')}>
          <TextUnderline16Regular />
        </ToolbarBtn>

        <span className={styles.divider} />

        <select
          className={styles.sizeSelect}
          value=""
          onChange={(e) => {
            const px = Number(e.target.value);
            if (px) applyFontSize(px);
            e.target.value = '';
          }}
          title="Font size"
          aria-label="Font size"
        >
          <option value="">Size</option>
          {FONT_SIZES.map((s) => (
            <option key={s.px} value={s.px}>
              {s.label}
            </option>
          ))}
        </select>

        <span className={styles.divider} />

        {COLORS.map((c) => (
          <button
            key={c.hex}
            type="button"
            className={styles.swatch}
            style={{ backgroundColor: c.hex }}
            title={c.name}
            aria-label={`Text colour ${c.name}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyColor(c.hex)}
          />
        ))}

        {!singleLine && (
          <>
            <span className={styles.divider} />
            <ToolbarBtn styles={styles} label="Align left" onClick={() => exec('justifyLeft')}>
              <TextAlignLeft16Regular />
            </ToolbarBtn>
            <ToolbarBtn styles={styles} label="Align center" onClick={() => exec('justifyCenter')}>
              <TextAlignCenter16Regular />
            </ToolbarBtn>
            <ToolbarBtn styles={styles} label="Align right" onClick={() => exec('justifyRight')}>
              <TextAlignRight16Regular />
            </ToolbarBtn>
            <span className={styles.divider} />
            <ToolbarBtn styles={styles} label="Bullet list" onClick={() => exec('insertUnorderedList')}>
              <TextBulletList16Regular />
            </ToolbarBtn>
            <ToolbarBtn
              styles={styles}
              label="Numbered list"
              onClick={() => exec('insertOrderedList')}
            >
              <TextNumberListLtr16Regular />
            </ToolbarBtn>
          </>
        )}
      </div>

      <div className={styles.editorHost}>
        <div
          ref={ref}
          className={styles.editor}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline={!singleLine}
          data-placeholder={placeholder ?? ''}
          onInput={() => {
            emit();
            detectSlash();
            saveSelection();
          }}
          onKeyDown={onEditorKeyDown}
          onKeyUp={saveSelection}
          onMouseUp={saveSelection}
          onBlur={() => {
            saveSelection();
            // Delay so a menu click lands before we close on blur.
            window.setTimeout(() => setSlash(null), 150);
          }}
        />
        {slash && slashMatches.length > 0 && (
          <div
            className={styles.slashMenu}
            style={{ top: slash.top, left: slash.left }}
            role="listbox"
          >
            {slashMatches.map((q, i) => (
              <button
                key={q.levelId}
                type="button"
                role="option"
                aria-selected={i === slash.index}
                className={`${styles.slashItem} ${i === slash.index ? styles.slashItemActive : ''}`}
                // Keep the caret while clicking.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setSlash((s) => (s ? { ...s, index: i } : s))}
                onClick={() => chooseSlash(q)}
              >
                <span className={styles.slashItemLabel}>{q.label}</span>
                {q.path && <span className={styles.slashItemPath}>{q.path}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ToolbarBtn({
  styles,
  label,
  onClick,
  children,
}: {
  styles: ReturnType<typeof useStyles>;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={label} relationship="label">
      <button
        type="button"
        className={styles.tbBtn}
        aria-label={label}
        // Keep the selection while clicking the toolbar (buttons steal focus).
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/* --- caret / DOM helpers -------------------------------------------------- */

/**
 * The answer chips the current selection touches. Read BEFORE execCommand
 * mutates the range. An inline `color` set on these beats the `.tok-chip`
 * class default and survives save → letter render.
 */
function chipsInSelection(root: HTMLElement): HTMLElement[] {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return [];
  const range = sel.getRangeAt(0);
  const out: HTMLElement[] = [];
  root.querySelectorAll('span.tok-chip').forEach((chip) => {
    if (range.intersectsNode(chip)) out.push(chip as HTMLElement);
  });
  return out;
}

function placeCaretAtEnd(el: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function insertHtmlAtCaret(el: HTMLElement, html: string): void {
  const sel = window.getSelection();
  const frag = document.createRange().createContextualFragment(html);
  if (sel && sel.rangeCount > 0 && el.contains(sel.anchorNode)) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(frag);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    el.appendChild(frag);
    placeCaretAtEnd(el);
  }
}
