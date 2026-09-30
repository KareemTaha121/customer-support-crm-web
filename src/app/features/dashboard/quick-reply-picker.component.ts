import { ChangeDetectionStrategy, Component, output } from '@angular/core';

/**
 * Quick reply picker (story FE-06). Contract used by the ticket and chat reply boxes:
 * `<app-quick-reply-picker (selected)="insert($event)" />` emits the reply body text.
 * Placeholder until FE-06 is implemented: renders nothing.
 */
@Component({
  selector: 'app-quick-reply-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class QuickReplyPickerComponent {
  readonly selected = output<string>();
}
