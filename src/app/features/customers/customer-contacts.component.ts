import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { HasPermissionDirective } from '../../core/permissions/has-permission.directive';
import { Permissions } from '../../core/permissions/permissions';
import { ConfirmService } from '../../shared/confirm-dialog.component';
import { EmptyStateComponent } from '../../shared/state.components';
import { ContactDialogComponent, ContactDialogData } from './contact-dialog.component';
import { CustomersApi } from './customers.api';
import { CONTACT_TYPES, ContactType, Customer, CustomerContactResponse } from './customers.models';

const ICONS: Record<ContactType, string> = { Email: 'mail', Phone: 'call', WhatsApp: 'chat', Address: 'home', Other: 'label' };

/** Contacts tab: add/edit/remove/set primary (customers.update). Emits the updated customer. */
@Component({
  selector: 'app-customer-contacts',
  imports: [MatButtonModule, MatIconModule, MatTooltipModule, TranslatePipe, HasPermissionDirective, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <p class="crm-muted">{{ 'customers.contacts.hint' | t }}</p>
      <button mat-stroked-button type="button" (click)="edit(null)" *appHasPermission="permissions.customersUpdate">
        <mat-icon>add</mat-icon>{{ 'customers.contacts.add' | t }}
      </button>
    </div>

    @for (group of groups(); track group.type) {
      <section class="crm-card group">
        <h3><mat-icon>{{ icons[group.type] }}</mat-icon>{{ 'customers.contactType.' + group.type | t }}</h3>
        <ul>
          @for (contact of group.contacts; track contact.id) {
            <li>
              <div class="value">
                <span class="text" [class.ltr]="group.type !== 'Address' && group.type !== 'Other'">{{ contact.value }}</span>
                @if (contact.label) {
                  <span class="crm-muted">· {{ contact.label }}</span>
                }
                @if (contact.isPrimary) {
                  <span class="crm-pill crm-pill--primary">{{ 'customers.contacts.primary' | t }}</span>
                }
              </div>
              <div class="actions" *appHasPermission="permissions.customersUpdate">
                @if (!contact.isPrimary) {
                  <button mat-icon-button type="button" [disabled]="busy()" (click)="setPrimary(contact)" [matTooltip]="'customers.contacts.makePrimary' | t" [attr.aria-label]="'customers.contacts.makePrimary' | t">
                    <mat-icon>star_outline</mat-icon>
                  </button>
                }
                <button mat-icon-button type="button" [disabled]="busy()" (click)="edit(contact)" [matTooltip]="'core.actions.edit' | t" [attr.aria-label]="'core.actions.edit' | t">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button type="button" [disabled]="busy()" (click)="remove(contact)" [matTooltip]="'customers.contacts.remove' | t" [attr.aria-label]="'customers.contacts.remove' | t">
                  <mat-icon>delete</mat-icon>
                </button>
              </div>
            </li>
          }
        </ul>
      </section>
    } @empty {
      <app-empty-state icon="contact_phone" [message]="'customers.contacts.empty' | t" />
    }
  `,
  styles: `
    .head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin-block-end: 12px; }
    .head p { margin: 0; }
    .group { margin-block-end: 12px; }
    h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; font: var(--mat-sys-title-small); }
    ul { list-style: none; margin: 0; padding: 0; }
    li { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 8px; padding-block: 4px; border-block-start: 1px solid var(--mat-sys-outline-variant); }
    li:first-child { border-block-start: 0; }
    .value { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; }
    .text { overflow-wrap: anywhere; }
    .ltr { direction: ltr; unicode-bidi: isolate; }
    .actions { display: flex; }
  `,
})
export class CustomerContactsComponent {
  private readonly api = inject(CustomersApi);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);

  readonly customer = input.required<Customer>();
  readonly customerChange = output<Customer>();

  readonly permissions = Permissions;
  readonly icons = ICONS;
  readonly busy = signal(false);

  readonly groups = computed(() =>
    CONTACT_TYPES.map((type) => ({ type, contacts: this.customer().contacts.filter((c) => c.type === type) })).filter((g) => g.contacts.length),
  );

  edit(contact: CustomerContactResponse | null): void {
    const data: ContactDialogData = { customerId: this.customer().id, contact };
    this.dialog
      .open<ContactDialogComponent, ContactDialogData, Customer>(ContactDialogComponent, { data, width: '480px', maxWidth: '95vw', direction: this.translations.direction() })
      .afterClosed()
      .subscribe((customer) => {
        if (customer) {
          this.toast.success('core.states.saved');
          this.customerChange.emit(customer);
        }
      });
  }

  setPrimary(contact: CustomerContactResponse): void {
    this.busy.set(true);
    this.api.setPrimaryContact(this.customer().id, contact.id).subscribe({
      next: (customer) => {
        this.busy.set(false);
        this.customerChange.emit(customer);
      },
      error: () => this.busy.set(false),
    });
  }

  remove(contact: CustomerContactResponse): void {
    this.confirm
      .ask({ title: 'customers.contacts.removeTitle', message: 'customers.contacts.removeMessage', params: { value: contact.value }, destructive: true, confirmText: 'customers.contacts.remove' })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.busy.set(true);
        this.api.removeContact(this.customer().id, contact.id).subscribe({
          next: (customer) => {
            this.busy.set(false);
            this.toast.success('core.states.deleted');
            this.customerChange.emit(customer);
          },
          error: () => this.busy.set(false),
        });
      });
  }
}
