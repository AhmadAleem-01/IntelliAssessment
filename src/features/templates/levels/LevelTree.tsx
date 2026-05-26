import { useState } from 'react';
import {
  Button,
  Spinner,
  MessageBar,
  MessageBarBody,
  makeStyles,
} from '@fluentui/react-components';
import { Add16Regular } from '@fluentui/react-icons';
import { useTemplateLevels } from './api';
import { buildTree, nextOrder, type LevelNode } from './treeBuilder';
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
  const [dialog, setDialog] = useState<DialogState>({ kind: 'closed' });

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

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div>
          <div className={styles.cardHeaderTitle}>Structure</div>
          <div className={styles.cardHeaderSub}>
            Sections, subsections, and questions for this template.
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

        {tree.length > 0 &&
          tree.map((node) => (
            <LevelTreeNode
              key={node.level.dnx_assessment_levelid}
              node={node}
              onAddChild={openAddChild}
              onEdit={(n) => setDialog({ kind: 'edit', node: n })}
              onDelete={(n) => setDialog({ kind: 'delete', node: n })}
            />
          ))}
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
