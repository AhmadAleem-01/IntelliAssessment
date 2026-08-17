import { useMemo, useState } from 'react';
import {
  OverlayDrawer,
  DrawerHeader,
  DrawerHeaderTitle,
  DrawerBody,
  Textarea,
  Button,
  Combobox,
  Option,
  OptionGroup,
  Spinner,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';
import {
  Send16Regular,
  Dismiss20Regular,
  Tag16Regular,
  Dismiss12Regular,
  Add16Regular,
} from '@fluentui/react-icons';
import type { Dnx_reviewer_comments } from '../../generated/models/Dnx_reviewer_commentsModel';
import { lookupId, lookupName } from '../../lib/dataverse';
import { useCurrentUser } from '../../lib/currentUser';
import {
  useReviewerComments,
  useAddComment,
  useDeleteComment,
} from './api';
import { useTemplateLevels } from '../templates/levels/api';
import { buildTree, type LevelNode } from '../templates/levels/treeBuilder';
import type { LevelType } from '../templates/levels/levelTypes';
import { parseCommentText, serializeCommentText } from './commentTags';
import { SegmentedControl } from '../../components/SegmentedControl';
import { ChevronRight16Regular } from '@fluentui/react-icons';

const useStyles = makeStyles({
  drawerSurface: { width: '440px', maxWidth: '92vw' },
  drawerHeader: { borderBottom: '1px solid var(--ds-border)', paddingBottom: '4px' },
  closeBtn: { minWidth: 0, color: 'var(--ds-text-muted)' },
  headerTitleRow: { display: 'flex', alignItems: 'baseline', gap: '10px' },
  headerTitleText: { fontSize: 'var(--ds-fs-h2)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  headerCount: { fontSize: 'var(--ds-fs-caption)', color: 'var(--ds-text-muted)' },
  tabs: { padding: '10px 18px 0' },

  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '16px 18px',
    flex: 1,
    overflowY: 'auto',
    backgroundColor: 'var(--ds-surface-base)',
  },
  empty: {
    fontSize: 'var(--ds-fs-body)',
    color: 'var(--ds-text-muted)',
    padding: '24px 4px',
    textAlign: 'center',
    lineHeight: 1.5,
  },

  /* A thread renders as one card with a violet left accent. */
  thread: {
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px 16px 12px 18px',
    backgroundColor: 'var(--ds-surface-card)',
    border: '1px solid var(--ds-border)',
    borderRadius: 'var(--ds-radius-card)',
    boxShadow: 'inset 3px 0 0 0 var(--ds-ai-primary)',
  },
  threadHead: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    paddingBottom: '10px',
    borderBottom: '1px solid var(--ds-border)',
    cursor: 'pointer',
    textDecoration: 'none',
    color: 'inherit',
  },
  threadHeadLabel: {
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--ds-text-muted)',
    flexShrink: 0,
  },
  threadHeadQuestion: {
    flex: 1,
    minWidth: 0,
    fontSize: 'var(--ds-fs-caption)',
    fontWeight: 600,
    color: 'var(--ds-ai-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  threadHeadChevron: { color: 'var(--ds-text-muted)', display: 'flex', flexShrink: 0 },

  comment: { display: 'flex', gap: '10px' },
  avatar: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    backgroundColor: 'var(--ds-brand-accent-soft)',
    color: 'var(--ds-brand-accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 600,
    flexShrink: 0,
  },
  commentMain: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' },
  meta: { display: 'flex', alignItems: 'baseline', gap: '8px' },
  author: { fontSize: 'var(--ds-fs-body)', fontWeight: 600, color: 'var(--ds-text-strong)' },
  time: { fontSize: '11px', color: 'var(--ds-text-muted)' },
  text: {
    fontSize: 'var(--ds-fs-body)',
    color: 'var(--ds-text-body)',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  // Reply is indented with a connecting line.
  reply: {
    paddingLeft: '14px',
    marginLeft: '3px',
    borderLeft: '2px solid var(--ds-border)',
  },
  showReplies: {
    background: 'transparent',
    border: 'none',
    padding: 0,
    marginTop: '2px',
    cursor: 'pointer',
    fontSize: 'var(--ds-fs-caption)',
    fontWeight: 600,
    color: 'var(--ds-ai-primary)',
    textAlign: 'left',
    ':hover': { textDecoration: 'underline' },
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    paddingTop: '2px',
  },
  actionBtn: {
    background: 'transparent',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontSize: 'var(--ds-fs-caption)',
    fontWeight: 600,
    color: 'var(--ds-text-body)',
    ':hover': { color: 'var(--ds-text-strong)' },
  },
  actionBtnResolve: { color: '#047857', ':hover': { color: '#036249' } },
  actionMore: { marginLeft: 'auto', color: 'var(--ds-text-muted)', lineHeight: 1, fontWeight: 700 },
  replyForm: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' },

  /* Composer footer */
  composer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '16px 18px',
    borderTop: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    flexShrink: 0,
  },
  composerInput: {
    borderRadius: '8px',
    border: '1px solid var(--ds-border)',
    '::after': { display: 'none' },
  },
  composerActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  composerActionsRight: { display: 'flex', gap: '8px', marginLeft: 'auto' },
  primaryBtn: {
    backgroundColor: 'var(--ds-brand-accent)',
    color: '#fff',
    border: '1px solid transparent',
    ':hover': { backgroundColor: 'var(--ds-brand-accent-hover)', color: '#fff' },
    ':disabled': { backgroundColor: 'var(--ds-surface-base)', color: 'var(--ds-text-muted)' },
  },
  taggedChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 8px 3px 10px',
    borderRadius: 'var(--ds-radius-pill)',
    fontSize: '11px',
    fontWeight: 600,
    backgroundColor: 'var(--ds-ai-surface)',
    color: 'var(--ds-ai-primary)',
    border: '1px solid var(--ds-ai-border)',
    width: 'fit-content',
  },
  taggedChipRemove: {
    background: 'transparent',
    border: 'none',
    padding: '2px',
    margin: 0,
    cursor: 'pointer',
    display: 'inline-flex',
    color: 'var(--ds-ai-primary)',
    borderRadius: '50%',
    ':hover': { backgroundColor: 'var(--ds-ai-glow)' },
  },
  inlineTagLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: 'var(--ds-radius-pill)',
    fontSize: '11px',
    fontWeight: 600,
    backgroundColor: 'var(--ds-ai-surface)',
    color: 'var(--ds-ai-primary)',
    border: '1px solid var(--ds-ai-border)',
    textDecoration: 'none',
    width: 'fit-content',
    cursor: 'pointer',
    ':hover': { backgroundColor: 'var(--ds-ai-glow)' },
  },
  fluidCombobox: {
    width: '100%',
    minWidth: 0,
    borderRadius: '8px',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    '::after': { display: 'none' },
    '& input': { fontSize: 'var(--ds-fs-body)', color: 'var(--ds-text-strong)' },
  },
  // Themed dropdown popup for the question picker (Fluent's default listbox
  // chrome doesn't match the DS).
  comboListbox: {
    borderRadius: 'var(--border-radius-md)',
    border: '1px solid var(--ds-border)',
    backgroundColor: 'var(--ds-surface-card)',
    boxShadow: '0 12px 32px -10px rgba(17, 24, 39, 0.28)',
    padding: '6px',
    maxHeight: '260px',
    '& [role="group"] > [role="presentation"], & .fui-OptionGroup__label': {
      fontSize: '10px',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: 'var(--ds-text-muted)',
      padding: '8px 10px 4px',
    },
    '& [role="option"]': {
      fontSize: 'var(--ds-fs-body)',
      color: 'var(--ds-text-body)',
      borderRadius: 'var(--border-radius-sm)',
      padding: '8px 10px',
    },
    '& [role="option"]:hover': {
      backgroundColor: 'var(--ds-surface-base)',
      color: 'var(--ds-text-strong)',
    },
    '& [role="option"][aria-selected="true"]': {
      backgroundColor: 'var(--ds-ai-surface)',
      color: 'var(--ds-ai-primary)',
      fontWeight: 600,
    },
  },
  tagTriggerBtn: {
    alignSelf: 'flex-start',
    color: 'var(--ds-text-muted)',
    fontSize: 'var(--ds-fs-caption)',
    fontWeight: 600,
    padding: '2px 6px',
    minWidth: 0,
    ':hover': { color: 'var(--ds-ai-primary)' },
  },
});

interface Props {
  instanceId: string;
  /** Template id so the question-tag picker can list every question. Optional
   *  — when omitted the tag picker is hidden. */
  templateId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set while opening, pre-tag the composer with this question (e.g. the
   *  assessor clicked "Reply" on a flagged question). Consumed once on open. */
  initialTaggedLevelId?: string | null;
}

interface TaggableQuestion {
  levelId: string;
  name: string;
  /** Section › Subsection breadcrumb for picker disambiguation. */
  path: string;
}

/** Flatten the level tree into taggable Questions grouped by section path. */
function listTaggableQuestions(tree: LevelNode[]): TaggableQuestion[] {
  const out: TaggableQuestion[] = [];
  const walk = (nodes: LevelNode[], prefix: string[]) => {
    for (const node of nodes) {
      const t = node.level.dnx_assessment_level_type as LevelType;
      if (t === 3) {
        out.push({
          levelId: node.level.dnx_assessment_levelid,
          name: node.level.dnx_name,
          path: prefix.join(' › '),
        });
      } else {
        walk(node.children, [...prefix, node.level.dnx_name]);
      }
    }
  };
  walk(tree, []);
  return out;
}

/** DOM id attached to each question row so tag chips can anchor to it. */
export function questionAnchorId(levelId: string): string {
  return `level-${levelId}`;
}

interface ThreadNode {
  comment: Dnx_reviewer_comments;
  replies: Dnx_reviewer_comments[];
}

/**
 * Right-side drawer holding the threaded general-comments stream for an
 * assessment instance. Opened from a hero button so it stays discoverable
 * (with a count badge) without consuming vertical space on the page.
 *
 * Per-question reviewer flags continue to render inline on `QuestionRow`
 * — this drawer filters them out so it only shows discussion threads not
 * tied to a single question.
 */
export function CommentsDrawer({
  instanceId,
  templateId,
  open,
  onOpenChange,
  initialTaggedLevelId,
}: Props) {
  const styles = useStyles();
  const { data: allComments, isLoading } = useReviewerComments(instanceId);
  const { data: currentUser } = useCurrentUser();
  // Only fetch levels when the drawer is open AND a templateId is available —
  // tag picker is the only consumer, so don't warm this query unnecessarily.
  const { data: levels } = useTemplateLevels(open ? templateId : undefined);
  const add = useAddComment(instanceId);
  const remove = useDeleteComment(instanceId);

  const [newText, setNewText] = useState('');
  const [taggedQuestion, setTaggedQuestion] = useState<TaggableQuestion | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyTaggedQuestion, setReplyTaggedQuestion] = useState<TaggableQuestion | null>(null);
  const [filter, setFilter] = useState<'open' | 'mentions'>('open');
  // Threads with their replies collapsed by default when there are 3+.
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  const taggableQuestions = useMemo(
    () => (levels ? listTaggableQuestions(buildTree(levels)) : []),
    [levels],
  );

  // Pre-tag the composer when opened via a flag's "Reply" (the parent passes
  // the flagged question's levelId). Uses React's "adjust state on change during
  // render" pattern (tracked keys) rather than an effect, so there's no
  // set-state-in-effect cascade. Re-applies if the questions finish loading
  // after the drawer opened (the resolved key changes when the match appears).
  const resolvedTag =
    open && initialTaggedLevelId
      ? taggableQuestions.find((t) => t.levelId === initialTaggedLevelId) ?? null
      : null;
  const [prevTagKey, setPrevTagKey] = useState<string | null>(null);
  const tagKey = resolvedTag ? `${open}:${resolvedTag.levelId}` : null;
  if (tagKey && tagKey !== prevTagKey) {
    setPrevTagKey(tagKey);
    setTaggedQuestion(resolvedTag);
  }
  // Group by section path so the Combobox lists nest naturally.
  const groupedTaggables = useMemo(() => {
    const m = new Map<string, TaggableQuestion[]>();
    for (const q of taggableQuestions) {
      const key = q.path || 'Top level';
      const list = m.get(key);
      if (list) list.push(q);
      else m.set(key, [q]);
    }
    return Array.from(m.entries());
  }, [taggableQuestions]);

  /** Close drawer, then ask any ancestor Section/Subsection to expand if the
   *  target lives inside their subtree (otherwise the anchor `<div>` isn't
   *  in the DOM yet), then scroll. Two staggered timeouts:
   *    220 ms — drawer slide-out animation finishes
   *    140 ms — Section/Subsection re-renders with expanded=true + the
   *             `.reveal` row transitions max-height from 0 to its final value.
   *  The element won't be found if the user navigates away mid-flight; that
   *  silent no-op is intentional. */
  function jumpToQuestion(levelId: string) {
    onOpenChange(false);
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent('intelli:jump-to-level', { detail: { levelId } }),
      );
      setTimeout(() => {
        const el = document.getElementById(questionAnchorId(levelId));
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 140);
    }, 220);
  }

  const threads = useMemo<ThreadNode[]>(() => {
    const general = (allComments ?? []).filter((c) => !lookupId(c, 'dnx_assessment_level'));
    const tops = general.filter((c) => !lookupId(c, 'dnx_parent_comment'));
    const byParent = new Map<string, Dnx_reviewer_comments[]>();
    for (const c of general) {
      const parentId = lookupId(c, 'dnx_parent_comment');
      if (!parentId) continue;
      const list = byParent.get(parentId);
      if (list) list.push(c);
      else byParent.set(parentId, [c]);
    }
    return tops.map((c) => ({
      comment: c,
      replies: (byParent.get(c.dnx_reviewer_commentid) ?? []).sort((a, b) =>
        (a.createdon ?? '').localeCompare(b.createdon ?? ''),
      ),
    }));
  }, [allComments]);

  // A thread is a "mention" when its top comment tags a question.
  const threadTagsQuestion = (t: ThreadNode) =>
    !!parseCommentText(t.comment.dnx_comment_text).taggedLevelId;
  const mentionCount = threads.filter(threadTagsQuestion).length;
  const shownThreads =
    filter === 'mentions' ? threads.filter(threadTagsQuestion) : threads;

  async function handlePost() {
    const text = newText.trim();
    if (!text) return;
    const serialized = serializeCommentText(
      text,
      taggedQuestion
        ? { id: taggedQuestion.levelId, name: taggedQuestion.name }
        : undefined,
    );
    await add.mutateAsync({ text: serialized });
    setNewText('');
    setTaggedQuestion(null);
  }

  async function handlePostReply(parentId: string) {
    const text = replyText.trim();
    if (!text) return;
    const serialized = serializeCommentText(
      text,
      replyTaggedQuestion
        ? { id: replyTaggedQuestion.levelId, name: replyTaggedQuestion.name }
        : undefined,
    );
    await add.mutateAsync({ text: serialized, parentCommentId: parentId });
    setReplyText('');
    setReplyingTo(null);
    setReplyTaggedQuestion(null);
  }

  function fmtTime(iso: string | undefined): string {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  return (
    <OverlayDrawer
      position="end"
      open={open}
      onOpenChange={(_, d) => onOpenChange(d.open)}
      className={styles.drawerSurface}
    >
      <DrawerHeader className={styles.drawerHeader}>
        <DrawerHeaderTitle
          action={
            <Button
              appearance="subtle"
              icon={<Dismiss20Regular />}
              className={styles.closeBtn}
              onClick={() => onOpenChange(false)}
              aria-label="Close comments"
            />
          }
        >
          <div className={styles.headerTitleRow}>
            <span className={styles.headerTitleText}>Comments</span>
            <span className={styles.headerCount}>
              {threads.length} thread{threads.length === 1 ? '' : 's'}
              {mentionCount > 0 ? ` · ${mentionCount} mention${mentionCount === 1 ? '' : 's'}` : ''}
            </span>
          </div>
        </DrawerHeaderTitle>
      </DrawerHeader>

      <div className={styles.tabs}>
        <SegmentedControl<'open' | 'mentions'>
          ariaLabel="Filter comments"
          value={filter}
          onChange={setFilter}
          items={[
            { key: 'open', label: 'Open', count: threads.length },
            { key: 'mentions', label: 'Mentions', count: mentionCount },
          ]}
        />
      </div>

      <DrawerBody style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
        <div className={styles.body}>
          {(add.error || remove.error) && (
            <MessageBar intent="error">
              <MessageBarBody>
                {((add.error ?? remove.error) as Error).message}
              </MessageBarBody>
            </MessageBar>
          )}

          {isLoading && <Spinner size="extra-tiny" label="Loading…" />}

          {!isLoading && shownThreads.length === 0 && (
            <div className={styles.empty}>
              {filter === 'mentions'
                ? 'No comments tag a question yet.'
                : "No comments yet. Start a thread to capture context that doesn't belong on a specific question."}
            </div>
          )}

          {shownThreads.map((thread) => {
            const tag = parseCommentText(thread.comment.dnx_comment_text);
            const repliesExpanded =
              thread.replies.length <= 2 ||
              expandedReplies.has(thread.comment.dnx_reviewer_commentid);
            const visibleReplies = repliesExpanded ? thread.replies : [];
            return (
            <div key={thread.comment.dnx_reviewer_commentid} className={styles.thread}>
              {tag.taggedLevelId && tag.taggedName && (
                <a
                  href={`#${questionAnchorId(tag.taggedLevelId)}`}
                  className={styles.threadHead}
                  onClick={(e) => {
                    e.preventDefault();
                    jumpToQuestion(tag.taggedLevelId!);
                  }}
                >
                  <span className={styles.threadHeadQuestion}>{tag.taggedName}</span>
                  <span className={styles.threadHeadChevron}>
                    <ChevronRight16Regular />
                  </span>
                </a>
              )}

              <CommentBlock
                styles={styles}
                comment={thread.comment}
                fmtTime={fmtTime}
                currentUserName={currentUser?.fullName}
                onReply={() => {
                  setReplyingTo(thread.comment.dnx_reviewer_commentid);
                  setReplyText('');
                  setReplyTaggedQuestion(null);
                }}
                onDelete={() => remove.mutate(thread.comment.dnx_reviewer_commentid)}
                canDelete={thread.replies.length === 0}
                deletePending={remove.isPending}
              />

              {!repliesExpanded && thread.replies.length > 0 && (
                <button
                  type="button"
                  className={styles.showReplies}
                  onClick={() =>
                    setExpandedReplies((prev) =>
                      new Set(prev).add(thread.comment.dnx_reviewer_commentid),
                    )
                  }
                >
                  Show {thread.replies.length} repl{thread.replies.length === 1 ? 'y' : 'ies'}
                </button>
              )}

              {visibleReplies.map((reply) => (
                <div key={reply.dnx_reviewer_commentid} className={styles.reply}>
                  <CommentBlock
                    styles={styles}
                    comment={reply}
                    fmtTime={fmtTime}
                    currentUserName={currentUser?.fullName}
                    onDelete={() => remove.mutate(reply.dnx_reviewer_commentid)}
                    canDelete
                    deletePending={remove.isPending}
                  />
                </div>
              ))}

              {replyingTo === thread.comment.dnx_reviewer_commentid && (
                <div className={`${styles.reply} ${styles.replyForm}`}>
                  <TagComposerInline
                    styles={styles}
                    tagged={replyTaggedQuestion}
                    onTaggedChange={setReplyTaggedQuestion}
                    groupedTaggables={groupedTaggables}
                  />
                  <Textarea
                    value={replyText}
                    onChange={(_, d) => setReplyText(d.value)}
                    placeholder="Reply…"
                    rows={2}
                    resize="vertical"
                  />
                  <div className={styles.composerActions}>
                    <Button
                      appearance="secondary"
                      size="small"
                      onClick={() => {
                        setReplyingTo(null);
                        setReplyText('');
                        setReplyTaggedQuestion(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      appearance="primary"
                      size="small"
                      icon={<Send16Regular />}
                      disabled={!replyText.trim() || add.isPending}
                      onClick={() => handlePostReply(thread.comment.dnx_reviewer_commentid)}
                    >
                      {add.isPending ? 'Posting…' : 'Post reply'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>

        <div className={styles.composer}>
          <Textarea
            className={styles.composerInput}
            value={newText}
            onChange={(_, d) => setNewText(d.value)}
            placeholder="Add a comment for this assessment…"
            rows={2}
            resize="vertical"
          />
          <div className={styles.composerActions}>
            <TagComposerInline
              styles={styles}
              tagged={taggedQuestion}
              onTaggedChange={setTaggedQuestion}
              groupedTaggables={groupedTaggables}
            />
            <div className={styles.composerActionsRight}>
              <Button
                appearance="primary"
                className={styles.primaryBtn}
                disabled={!newText.trim() || add.isPending}
                onClick={handlePost}
              >
                {add.isPending ? 'Posting…' : 'Post comment'}
              </Button>
            </div>
          </div>
        </div>
      </DrawerBody>
    </OverlayDrawer>
  );
}

/**
 * Tag-question affordance shown inline with the textarea in both composers.
 *
 * Three states drive the rendered UI:
 *   - **Tagged** → purple chip with the question name and an `×` remove button.
 *   - **Picking** → searchable Combobox grouped by section path, auto-focused.
 *   - **Idle** → tiny subtle `+ Tag a question` link/button so the composer
 *     stays compact when no tag is needed.
 *
 * The picker collapses back to Idle on blur if nothing was selected.
 */
function TagComposerInline({
  styles,
  tagged,
  onTaggedChange,
  groupedTaggables,
}: {
  styles: ReturnType<typeof useStyles>;
  tagged: TaggableQuestion | null;
  onTaggedChange: (q: TaggableQuestion | null) => void;
  groupedTaggables: Array<[string, TaggableQuestion[]]>;
}) {
  const [picking, setPicking] = useState(false);

  // No questions to pick from yet (still loading or template has none).
  if (groupedTaggables.length === 0 && !tagged) return null;

  if (tagged) {
    return (
      <span className={styles.taggedChip}>
        <Tag16Regular />
        Tagged: {tagged.name}
        <button
          type="button"
          className={styles.taggedChipRemove}
          onClick={() => onTaggedChange(null)}
          aria-label="Remove tag"
        >
          <Dismiss12Regular />
        </button>
      </span>
    );
  }

  if (picking) {
    return (
      <Combobox
        className={styles.fluidCombobox}
        listbox={{ className: styles.comboListbox }}
        placeholder="Search or pick a question…"
        size="small"
        autoFocus
        defaultOpen
        onOptionSelect={(_, d) => {
          const id = d.optionValue;
          if (!id) return;
          for (const [, qs] of groupedTaggables) {
            const q = qs.find((q) => q.levelId === id);
            if (q) {
              onTaggedChange(q);
              setPicking(false);
              return;
            }
          }
        }}
        onBlur={() => setPicking(false)}
      >
        {groupedTaggables.map(([path, qs]) => (
          <OptionGroup key={path} label={path}>
            {qs.map((q) => (
              <Option key={q.levelId} value={q.levelId} text={q.name}>
                {q.name}
              </Option>
            ))}
          </OptionGroup>
        ))}
      </Combobox>
    );
  }

  return (
    <Button
      appearance="subtle"
      size="small"
      icon={<Add16Regular />}
      className={styles.tagTriggerBtn}
      onClick={() => setPicking(true)}
    >
      Tag a question
    </Button>
  );
}

interface CommentBlockProps {
  styles: ReturnType<typeof useStyles>;
  comment: Dnx_reviewer_comments;
  fmtTime: (iso: string | undefined) => string;
  currentUserName?: string;
  onReply?: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
  deletePending?: boolean;
}
function CommentBlock({
  styles,
  comment,
  fmtTime,
  currentUserName,
  onReply,
  onDelete,
  canDelete,
  deletePending,
}: CommentBlockProps) {
  const author =
    lookupName(comment, 'ownerid') ??
    comment.owneridname ??
    lookupName(comment, 'createdby') ??
    comment.createdbyname ??
    currentUserName ??
    'You';
  // Tag context is rendered once at the thread-card header, so only the body
  // text is shown per comment here.
  const { body } = parseCommentText(comment.dnx_comment_text);
  const initials = author
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';
  return (
    <div className={styles.comment}>
      <span className={styles.avatar} aria-hidden>{initials}</span>
      <div className={styles.commentMain}>
        <div className={styles.meta}>
          <span className={styles.author}>{author}</span>
          <span className={styles.time}>{fmtTime(comment.createdon)}</span>
        </div>
        <div className={styles.text}>{body}</div>
        {(onReply || (onDelete && canDelete)) && (
          <div className={styles.actions}>
            {onReply && (
              <button type="button" className={styles.actionBtn} onClick={onReply}>
                Reply
              </button>
            )}
            {onDelete && canDelete && (
              <button
                type="button"
                className={styles.actionBtn}
                disabled={deletePending}
                onClick={onDelete}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Hook helper for the hero button — returns the count of general (not
 * question-tied) comments so the trigger can render `Comments (N)`.
 */
export function useGeneralCommentCount(instanceId: string | undefined): number {
  const { data } = useReviewerComments(instanceId);
  return useMemo(
    () =>
      (data ?? []).filter((c) => !lookupId(c, 'dnx_assessment_level')).length,
    [data],
  );
}
