import { useState } from 'react';
import {
  Button,
  Spinner,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';
import { Add16Regular } from '@fluentui/react-icons';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { useTemplateLevels, useReorderLevels, useDuplicateLevel } from './api';
import { buildTree, findBucket, nextOrder, type LevelNode } from './treeBuilder';
import { lookupId } from '../../../lib/dataverse';
import { LevelTreeNode } from './LevelTreeNode';
import { LevelDialog } from './LevelDialog';
import { DeleteLevelDialog } from './DeleteLevelDialog';
import { LEVEL_TYPE_CODE, type LevelType } from './levelTypes';

const useStyles = makeStyles({
  card: {
    backgroundColor: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-lg)',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '14px 18px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '12px',
  },
  cardHeaderTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
  cardHeaderSub: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
    marginTop: '2px',
  },
  cardBody: {
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minHeight: '120px',
  },
  empty: {
    padding: '40px 20px',
    textAlign: 'center',
    color: 'var(--color-text-secondary)',
    fontSize: '13px',
    border: '0.5px dashed var(--color-border-tertiary)',
    borderRadius: 'var(--border-radius-md)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
  },
  emptyTitle: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--color-text-primary)',
  },
});

interface Props {
  templateId: string;
}

type DialogState =
  | { kind: 'closed' }
  | {
      kind: 'add';
      parentLevelId: string | null;
      parentLabel?: string;
      levelType: LevelType;
      order: number;
    }
  | { kind: 'edit'; node: LevelNode }
  | { kind: 'delete'; node: LevelNode };

export function LevelTree({ templateId }: Props) {
  const styles = useStyles();
  const { data: levels, isLoading, error } = useTemplateLevels(templateId);
  const reorder = useReorderLevels(templateId);
  const duplicate = useDuplicateLevel(templateId);
  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' });

  // Pointer sensor with a tiny drag distance so quick clicks still register
  // as buttons (Edit / Delete / chevron) rather than starting a drag.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const tree = buildTree(levels);

  function openAddSection() {
    setDialog({
      kind: 'add',
      parentLevelId: null,
      levelType: LEVEL_TYPE_CODE.Section,
      order: nextOrder(tree),
    });
  }

  function openAddChild(parent: LevelNode, childType: LevelType) {
    setDialog({
      kind: 'add',
      parentLevelId: parent.level.dnx_assessment_levelid,
      parentLabel: parent.level.dnx_name,
      levelType: childType,
      order: nextOrder(parent.children),
    });
  }

  function closeDialog() {
    setDialog({ kind: 'closed' });
  }

  function handleDuplicate(node: LevelNode) {
    // Place the copy at the end of the same sibling bucket the source lives in.
    // Top-level sections have no parent → null. Otherwise read the parent's GUID
    // off the source via the lookup helper.
    const parentLevelId = lookupId(node.level, 'dnx_parent_assessment_level') ?? null;
    const bucket = parentLevelId
      ? findBucket(tree, node.level.dnx_assessment_levelid)?.bucket ?? []
      : tree;
    duplicate.mutate({
      source: node,
      parentLevelId,
      order: nextOrder(bucket),
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeBucket = findBucket(tree, String(active.id));
    const overBucket = findBucket(tree, String(over.id));
    if (!activeBucket || !overBucket) return;
    // Only same-bucket moves in v1 — cross-parent drops are ignored.
    if (activeBucket.bucket !== overBucket.bucket) return;

    const orderedIds = arrayMove(
      activeBucket.bucket.map((n) => n.level.dnx_assessment_levelid),
      activeBucket.index,
      overBucket.index,
    );
    reorder.mutate({
      orderedIds,
      currentLevels: levels ?? [],
    });
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardHeaderTitle}>Structure</div>
          <div className={styles.cardHeaderSub}>
            Sections, subsections, and questions for this template. Drag the handle
            on the left of any row to reorder.
          </div>
        </div>
        <Button appearance="primary" icon={<Add16Regular />} onClick={openAddSection}>
          Add section
        </Button>
      </div>

      <div className={styles.cardBody}>
        {isLoading && <Spinner label="Loading structure..." size="tiny" />}

        {error && (
          <MessageBar intent="error">
            <MessageBarBody>{(error as Error).message}</MessageBarBody>
          </MessageBar>
        )}

        {reorder.error && (
          <MessageBar intent="error">
            <MessageBarBody>
              Failed to save new order: {(reorder.error as Error).message}
            </MessageBarBody>
          </MessageBar>
        )}

        {duplicate.error && (
          <MessageBar intent="error">
            <MessageBarBody>
              Failed to duplicate: {(duplicate.error as Error).message}
            </MessageBarBody>
          </MessageBar>
        )}

        {!isLoading && !error && tree.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>No sections yet</div>
            <div>
              Templates are organised as Sections → Subsections → Questions. Start with
              your first section.
            </div>
            <Button appearance="primary" icon={<Add16Regular />} onClick={openAddSection}>
              Add your first section
            </Button>
          </div>
        )}

        {tree.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={tree.map((n) => n.level.dnx_assessment_levelid)}
              strategy={verticalListSortingStrategy}
            >
              {tree.map((node) => (
                <LevelTreeNode
                  key={node.level.dnx_assessment_levelid}
                  node={node}
                  onAddChild={openAddChild}
                  onEdit={(n) => setDialog({ kind: 'edit', node: n })}
                  onDelete={(n) => setDialog({ kind: 'delete', node: n })}
                  onDuplicate={handleDuplicate}
                  duplicatingId={duplicate.isPending ? '*' : null}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      {dialog.kind === 'add' && (
        <LevelDialog
          mode="add"
          open
          onClose={closeDialog}
          templateId={templateId}
          parentLevelId={dialog.parentLevelId}
          parentLabel={dialog.parentLabel}
          levelType={dialog.levelType}
          order={dialog.order}
        />
      )}

      {dialog.kind === 'edit' && (
        <LevelDialog
          mode="edit"
          open
          onClose={closeDialog}
          templateId={templateId}
          level={dialog.node.level}
        />
      )}

      <DeleteLevelDialog
        open={dialog.kind === 'delete'}
        onClose={closeDialog}
        templateId={templateId}
        node={dialog.kind === 'delete' ? dialog.node : null}
      />
    </div>
  );
}
