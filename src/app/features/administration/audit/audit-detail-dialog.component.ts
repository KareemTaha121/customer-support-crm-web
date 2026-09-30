import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { LocalizedDatePipe } from '../../../core/localization/localized-date.pipe';
import { TranslatePipe } from '../../../core/localization/translate.pipe';
import { AuditLogResponse } from '../administration.models';

/** One audit entry with its metadata and pretty-printed old/new values. */
@Component({
  selector: 'app-audit-detail-dialog',
  imports: [MatDialogModule, MatButtonModule, TranslatePipe, LocalizedDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: '../admin.scss',
  template: `
    <h2 mat-dialog-title>{{ 'admin.audit.detailTitle' | t }}</h2>
    <mat-dialog-content>
      <dl class="meta">
        <dt>{{ 'admin.audit.occurredAt' | t }}</dt>
        <dd>{{ entry.occurredAt | localDate: 'medium' }}</dd>
        <dt>{{ 'admin.audit.actor' | t }}</dt>
        <dd>{{ entry.actorDisplayName ?? ('admin.audit.system' | t) }}</dd>
        <dt>{{ 'admin.audit.action' | t }}</dt>
        <dd class="admin-mono" dir="ltr">{{ entry.action }}</dd>
        <dt>{{ 'admin.audit.entityType' | t }}</dt>
        <dd>{{ entry.entityType }}</dd>
        <dt>{{ 'admin.audit.entityId' | t }}</dt>
        <dd class="admin-mono" dir="ltr">{{ entry.entityId ?? '—' }}</dd>
        <dt>{{ 'admin.audit.ipAddress' | t }}</dt>
        <dd class="admin-mono" dir="ltr">{{ entry.ipAddress ?? '—' }}</dd>
        <dt>{{ 'admin.audit.userAgent' | t }}</dt>
        <dd class="admin-mono" dir="ltr">{{ entry.userAgent ?? '—' }}</dd>
        <dt>{{ 'admin.audit.correlationId' | t }}</dt>
        <dd class="admin-mono" dir="ltr">{{ entry.correlationId ?? '—' }}</dd>
      </dl>
      <div class="values">
        <section>
          <h3>{{ 'admin.audit.oldValues' | t }}</h3>
          @if (oldJson) {
            <pre dir="ltr">{{ oldJson }}</pre>
          } @else {
            <p class="crm-muted">{{ 'core.states.none' | t }}</p>
          }
        </section>
        <section>
          <h3>{{ 'admin.audit.newValues' | t }}</h3>
          @if (newJson) {
            <pre dir="ltr">{{ newJson }}</pre>
          } @else {
            <p class="crm-muted">{{ 'core.states.none' | t }}</p>
          }
        </section>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button type="button" mat-dialog-close>{{ 'core.actions.close' | t }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .meta { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 0 0 12px; }
    dt { color: var(--mat-sys-on-surface-variant); }
    dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
    .values { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
    h3 { margin: 0 0 6px; font: var(--mat-sys-title-small); }
    pre { margin: 0; padding: 10px; max-height: 320px; overflow: auto; border-radius: 8px; background: var(--mat-sys-surface-container-high); font-size: 12px; text-align: left; }
  `,
})
export class AuditDetailDialogComponent {
  readonly entry = inject<AuditLogResponse>(MAT_DIALOG_DATA);
  readonly oldJson = prettyJson(this.entry.oldValues);
  readonly newJson = prettyJson(this.entry.newValues);
}

function prettyJson(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
