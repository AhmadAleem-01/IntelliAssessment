import { useParams } from 'react-router-dom';
import { Title2, Body1, Card, MessageBar, MessageBarBody } from '@fluentui/react-components';

export function AssessmentPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  return (
    <div>
      <Title2>Assessment</Title2>
      <Body1 style={{ color: 'gray', marginTop: 4 }}>
        Checklist runtime (left rail · checklist · Details tab) lands in Milestone 4.
      </Body1>
      <Card style={{ marginTop: 16, padding: 20 }}>
        <MessageBar intent="info">
          <MessageBarBody>
            Assessment instance <code>{assessmentId}</code>.
          </MessageBarBody>
        </MessageBar>
      </Card>
    </div>
  );
}
