import React from 'react';
import { StatCard as StatCardType } from '../types';

interface StatCardProps {
  card: StatCardType;
}

const StatCard: React.FC<StatCardProps> = ({ card }) => {
  const deltaColor =
    card.trend === 'up' ? 'var(--app-accent-strong)' : card.trend === 'down' ? 'var(--app-danger)' : 'var(--app-muted)';

  return (
    <div style={styles.card}>
      <div style={styles.label}>{card.label}</div>
      <div style={styles.value}>{card.value}</div>
      <div style={{ ...styles.delta, color: deltaColor }}>{card.delta}</div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--app-surface)',
    border: '1px solid var(--app-border)',
    borderRadius: 8,
    padding: '14px 16px',
    boxShadow: 'var(--app-shadow)',
  },
  label: {
    fontSize: 12,
    color: 'var(--app-muted)',
    marginBottom: 6,
  },
  value: {
    fontSize: 22,
    fontWeight: 500,
    color: 'var(--app-text-strong)',
  },
  delta: {
    fontSize: 11,
    marginTop: 4,
  },
};

export default StatCard;
