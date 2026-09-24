import React from 'react';

interface ComingSoonProps {
  title: string;
  icon?: string;
}

const ComingSoon: React.FC<ComingSoonProps> = ({ title, icon = 'ti-tool' }) => {
  return (
    <div style={styles.container}>
      <i className={`ti ${icon}`} style={styles.icon} aria-hidden="true" />
      <p style={styles.title}>{title} — coming soon</p>
      <p style={styles.sub}>This section will be filled in later</p>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
    color: 'var(--app-muted)',
  },
  icon: {
    fontSize: 36,
    display: 'block',
    marginBottom: 12,
  },
  title: {
    fontWeight: 500,
    color: 'var(--app-muted)',
    marginBottom: 6,
    fontSize: 15,
  },
  sub: {
    fontSize: 12,
  },
};

export default ComingSoon;
