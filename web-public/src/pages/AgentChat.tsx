import AgentChatPanel from '../components/AgentChatPanel';
import { useI18n } from '../i18n';

export default function AgentChat() {
  const { t } = useI18n();

  return (
    <div className="agent-page-wrap">
      <header className="agent-page-header">
        <h1>
          RA Labs <em>AI Agent</em>
        </h1>
        <p className="agent-subtitle">
          {t(
            'agent.page.subtitle',
            'Ask about our work, services and process — or let the agent collect your project brief.'
          )}
        </p>
      </header>
      <AgentChatPanel mode="page" />
    </div>
  );
}