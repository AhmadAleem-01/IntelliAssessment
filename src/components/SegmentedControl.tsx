import { useLayoutEffect, useRef, useState } from 'react';
import { makeStyles } from '@fluentui/react-components';

/*
 * SegmentedControl — the app's canonical tab-like toggle (design.md §4).
 *
 * A single navy indicator slides behind the tabs with a springy easing. Unlike
 * an index-based transform, the indicator is *measured* from the active button's
 * offset + width, so it lands correctly on variable-width labels ("All" vs
 * "Needs attention"). Use this everywhere a tab/segment toggle is needed so the
 * animation stays consistent.
 */
const useStyles = makeStyles({
  root: {
    position: 'relative',
    display: 'inline-flex',
    // Shrink-wrap to its tabs — in a column-flex/grid parent the default
    // align-items:stretch would otherwise pull it to full width.
    alignSelf: 'flex-start',
    width: 'fit-content',
    maxWidth: '100%',
    padding: '5px',
    borderRadius: '12px',
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
  },
  indicator: {
    position: 'absolute',
    top: '5px',
    bottom: '5px',
    left: 0,
    borderRadius: '9px',
    backgroundColor: 'var(--ds-brand-primary)',
    transition: 'transform 0.32s cubic-bezier(0.34, 1.4, 0.5, 1), width 0.32s cubic-bezier(0.34, 1.4, 0.5, 1)',
    zIndex: 0,
    // Hidden until measured (avoids a flash at 0,0 on first paint).
    opacity: 0,
  },
  indicatorReady: { opacity: 1 },
  btn: {
    position: 'relative',
    zIndex: 1,
    border: 'none',
    background: 'transparent',
    padding: '7px 14px',
    borderRadius: '9px',
    fontSize: 'var(--ds-fs-caption)',
    fontWeight: 500,
    color: 'var(--ds-text-muted)',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    whiteSpace: 'nowrap',
    transition: 'color 0.25s ease',
    ':hover': { color: 'var(--ds-text-body)' },
  },
  btnActive: {
    // Forced so equal-specificity hover can't dim the text on the navy pill.
    color: '#fff !important',
  },
  count: { opacity: 0.65, fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
});

export interface SegmentedItem<K extends string> {
  key: K;
  label: string;
  /** Optional trailing count chip. */
  count?: number;
}

interface Props<K extends string> {
  items: SegmentedItem<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Accessible label for the tablist. */
  ariaLabel?: string;
}

export function SegmentedControl<K extends string>({
  items,
  value,
  onChange,
  ariaLabel,
}: Props<K>) {
  const styles = useStyles();
  const btnRefs = useRef(new Map<K, HTMLButtonElement | null>());
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);

  // Measure the active button and move the indicator to it. useLayoutEffect so
  // the position is set before paint (no visible jump); re-measures when the
  // selection or the item set changes.
  useLayoutEffect(() => {
    const el = btnRefs.current.get(value);
    if (el) setBox({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, items]);

  return (
    <div className={styles.root} role="tablist" aria-label={ariaLabel}>
      <span
        className={`${styles.indicator} ${box ? styles.indicatorReady : ''}`}
        style={box ? { transform: `translateX(${box.left}px)`, width: `${box.width}px` } : undefined}
        aria-hidden
      />
      {items.map((item) => {
        const active = item.key === value;
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            ref={(el) => {
              btnRefs.current.set(item.key, el);
            }}
            className={`${styles.btn} ${active ? styles.btnActive : ''}`}
            onClick={() => onChange(item.key)}
          >
            {item.label}
            {item.count !== undefined && <span className={styles.count}>{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
