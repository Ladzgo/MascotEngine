import React from 'react';
import {t} from './i18n';

/** Loading placeholder: skeleton bars (styled by .skeleton, see docs/UI_FINDINGS.md) plus the text for screen readers and unstyled builds. */
export function Loading() {
  return (
    <div className="skeleton-wrap" role="status" aria-busy="true">
      <p className="muted">{t('Loading…')}</p>
      <div className="skeleton sk-title" aria-hidden="true" />
      <div className="skeleton sk-row" aria-hidden="true" /><div className="skeleton sk-row" aria-hidden="true" /><div className="skeleton sk-row" aria-hidden="true" />
    </div>
  );
}
