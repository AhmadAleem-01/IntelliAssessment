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
  Comment16Regular,
  ArrowReply16Regular,
  Delete16Regular,
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

const useStyles = makeStyles({
  drawerSurface: {
    width: '420px',
    maxWidth: '90vw',
  },
  drawerHeader: {
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  closeBtn: {
    minWidth: 0,
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    padding: '16px 18px',
    flex: 1,
    overflowY: 'auto',
  },
  empty: {
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
    padding: '8px 0',
  },
  thread: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    paddingBottom: '12px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    ':last-child': { borderBottom: 'none', paddingBottom: 0 },
  },
  comment: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  reply: {
    marginLeft: '24px',
    paddingLeft: '12px',
    borderLeft: '2px solid var(--color-border-tertiary)',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '11px',
    color: 'var(--color-text-tertiary)',
  },
  author: {
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  text: {
    fontSize: '13px',
    color: 'var(--color-text-primary)',
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  actions: {
    display: 'flex',
    gap: '4px',
    marginTop: '2px',
  },
  iconBtn: {
    fontSize: '11px',
    minWidth: 0,
    padding: '2px 6px',
  },
  replyForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginTop: '6px',
  },
  composer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '14px 18px',
    borderTop: '0.5px solid var(--color-border-tertiary)',
    backgroundColor: 'var(--color-background-secondary)',
    // Pin composer to the drawer footer so users can post without scrolling
    // back down after a long thread.
    flexShrink: 0,
  },
  composerActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  composerActionsRight: {
    display: 'flex',
    gap: '8px',
    marginLeft: 'auto',
  },
  taggedChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 8px 3px 10px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 500,
    backgroundColor: 'var(--color-purple-soft)',
    color: 'var(--color-purple-text)',
    border: '0.5px solid var(--color-purple)',
    width: 'fit-content',
  },
  taggedChipRemove: {
    background: 'transparent',
    border: 'none',
    padding: '2px',
    margin: 0,
    cursor: 'pointer',
    display: 'inline-flex',
    color: 'var(--color-purple-text)',
    borderRadius: '50%',
    ':hover': { backgroundColor: 'rgba(127,119,221,0.15)' },
  },
  inlineTagLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 500,
    backgroundColor: 'var(--color-purple-soft)',
    color: 'var(--color-purple-text)',
    border: '0.5px solid var(--color-purple)',
    textDecoration: 'none',
    width: 'fit-content',
    cursor: 'pointer',
    ':hover': { backgroundColor: 'rgba(127,119,221,0.25)' },
  },
  fluidCombobox: {
    width: '100%',
    minWidth: 0,
  },
  // Subtle "+ Tag question" trigger that sits inline below the textarea.
  // Stays out of the way until the user actually wants to attach a tag.
  tagTriggerBtn: {
    alignSelf: 'flex-start',
    color: 'var(--color-text-secondary)',
    fontSize: '11px',
    padding: '2px 6px',
    minWidth: 0,
    ':hover': { color: 'var(--color-purple-text)' },
  },
  headerTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  headerCount: {
    fontSize: '11px',
    fontWeight: 400,
    color: 'var(--color-text-tertiary)',
  },
});

interface Props {
  instanceId: string;
  /** Template id so the question-tag picker can list every question. Optional
   *  — when omitted the tag picker is hidden. */
  templateId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
export function CommentsDrawer({ instanceId, templateId, open, onOpenChange }: Props) {
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

  const taggableQuestions = useMemo(
    () => (levels ? listTaggableQuestions(buildTree(levels)) : []),
    [levels],
  );
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

  const totalGeneral = threads.reduce((sum, t) => sum + 1 + t.replies.length, 0);

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
            <Comment16Regular />
            Comments
            <span className={styles.headerCount}>
              {totalGeneral} thread{totalGeneral === 1 ? '' : 's'}
            </span>
          </div>
        </DrawerHeaderTitle>
      </DrawerHeader>

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

          {!isLoading && threads.length === 0 && (
            <div className={styles.empty}>
              No comments yet. Start a thread to capture context that doesn't belong on a specific question.
            </div>
          )}

          {threads.map((thread) => (
            <div key={thread.comment.dnx_reviewer_commentid} className={styles.thread}>
              <CommentBlock
                styles={styles}
                comment={thread.comment}
                fmtTime={fmtTime}
                currentUserName={currentUser?.fullName}
                onTagClick={jumpToQuestion}
                onReply={() => {
                  setReplyingTo(thread.comment.dnx_reviewer_commentid);
                  setReplyText('');
                  setReplyTaggedQuestion(null);
                }}
                onDelete={() => remove.mutate(thread.comment.dnx_reviewer_commentid)}
                canDelete={thread.replies.length === 0}
                deletePending={remove.isPending}
              />

              {thread.replies.map((reply) => (
                <div key={reply.dnx_reviewer_commentid} className={styles.reply}>
                  <CommentBlock
                    styles={styles}
                    comment={reply}
                    fmtTime={fmtTime}
                    currentUserName={currentUser?.fullName}
                    onTagClick={jumpToQuestion}
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
          ))}
        </div>

        <div className={styles.composer}>
          <TagComposerInline
            styles={styles}
            tagged={taggedQuestion}
            onTaggedChange={setTaggedQuestion}
            groupedTaggables={groupedTaggables}
          />
          <Textarea
            value={newText}
            onChange={(_, d) => setNewText(d.value)}
            placeholder="Add a comment…"
            rows={2}
            resize="vertical"
          />
          <div className={styles.composerActions}>
            <div className={styles.composerActionsRight}>
              <Button
                appearance="primary"
                size="small"
                icon={<Send16Regular />}
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
        placeholder="Search a question…"
        size="small"
        autoFocus
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
  /** Click handler for the tag chip — closes drawer + scrolls to the question. */
  onTagClick?: (levelId: string) => void;
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
  onTagClick,
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
  const { taggedLevelId, taggedName, body } = parseCommentText(
    comment.dnx_comment_text,
  );
  return (
    <div className={styles.comment}>
      <div className={styles.meta}>
        <span className={styles.author}>{author}</span>
        <span>·</span>
        <span>{fmtTime(comment.createdon)}</span>
      </div>
      {taggedLevelId && taggedName && (
        <a
          href={`#${questionAnchorId(taggedLevelId)}`}
          className={styles.inlineTagLink}
          onClick={(e) => {
            if (!onTagClick) return;
            e.preventDefault();
            onTagClick(taggedLevelId);
          }}
        >
          <Tag16Regular />
          {taggedName}
        </a>
      )}
      <div className={styles.text}>{body}</div>
      <div className={styles.actions}>
        {onReply && (
          <Button
            appearance="subtle"
            size="small"
            icon={<ArrowReply16Regular />}
            className={styles.iconBtn}
            onClick={onReply}
          >
            Reply
          </Button>
        )}
        {onDelete && canDelete && (
          <Button
            appearance="subtle"
            size="small"
            icon={<Delete16Regular />}
            className={styles.iconBtn}
            disabled={deletePending}
            onClick={onDelete}
          >
            Delete
          </Button>
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
