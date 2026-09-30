import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiError } from '../../core/http/api-error';
import { describeError } from '../../core/interceptors/error.interceptor';
import { NotificationToastService } from '../../core/layout/notification-toast.service';
import { TranslatePipe } from '../../core/localization/translate.pipe';
import { TranslationService } from '../../core/localization/translation.service';
import { HasPermissionDirective } from '../../core/permissions/has-permission.directive';
import { PermissionService } from '../../core/permissions/permission.service';
import { Permissions } from '../../core/permissions/permissions';
import { ConfirmService } from '../../shared/confirm-dialog.component';
import { PageHeaderComponent } from '../../shared/page-header.component';
import { ErrorStateComponent, LoadingComponent } from '../../shared/state.components';
import { CustomerAttachmentsComponent } from './customer-attachments.component';
import { CustomerContactsComponent } from './customer-contacts.component';
import { CustomerHistoryComponent } from './customer-history.component';
import { CustomerNotesComponent } from './customer-notes.component';
import { CustomerProfileTabComponent } from './customer-profile-tab.component';
import { CustomersApi } from './customers.api';
import { Customer } from './customers.models';
import { PortalAccessDialogComponent, PortalAccessDialogData } from './portal-access-dialog.component';

/** `/customers/:id`: header actions and the Profile / Contacts / Notes / Attachments / History tabs. */
@Component({
  selector: 'app-customer-details-page',
  imports: [
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTabsModule,
    TranslatePipe,
    HasPermissionDirective,
    PageHeaderComponent,
    LoadingComponent,
    ErrorStateComponent,
    CustomerProfileTabComponent,
    CustomerContactsComponent,
    CustomerNotesComponent,
    CustomerAttachmentsComponent,
    CustomerHistoryComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (error(); as message) {
      <app-page-header [title]="'customers.details.title' | t" backLink="/customers" />
      <app-error-state [message]="message" (retry)="load()" />
    } @else if (customer(); as c) {
      <app-page-header [title]="c.name" [subtitle]="c.number + (c.companyName ? ' · ' + c.companyName : '')" backLink="/customers">
        <span class="badges">
          <span class="crm-pill" [class.crm-pill--success]="c.status === 'Active'">{{ 'customers.status.' + c.status | t }}</span>
          @if (c.hasPortalAccount) {
            <span class="crm-pill crm-pill--info"><mat-icon inline>verified_user</mat-icon>{{ 'customers.portal.hasAccess' | t }}</span>
          }
        </span>
        <a mat-stroked-button [routerLink]="['/customers', c.id, 'edit']" *appHasPermission="permissions.customersUpdate">
          <mat-icon>edit</mat-icon>{{ 'core.actions.edit' | t }}
        </a>
        @if (hasMoreActions()) {
          <button mat-icon-button type="button" [matMenuTriggerFor]="more" [attr.aria-label]="'core.actions.more' | t">
            <mat-icon>more_vert</mat-icon>
          </button>
          <mat-menu #more="matMenu">
            <ng-container *appHasPermission="permissions.customersUpdate">
              @if (c.hasPortalAccount) {
                <button mat-menu-item type="button" (click)="revokePortal(c)"><mat-icon>person_off</mat-icon>{{ 'customers.portal.revoke' | t }}</button>
              } @else {
                <button mat-menu-item type="button" (click)="grantPortal(c)"><mat-icon>vpn_key</mat-icon>{{ 'customers.portal.grant' | t }}</button>
              }
            </ng-container>
            <button mat-menu-item type="button" class="danger-item" (click)="remove(c)" *appHasPermission="permissions.customersDelete">
              <mat-icon>delete</mat-icon>{{ 'customers.details.delete' | t }}
            </button>
          </mat-menu>
        }
      </app-page-header>

      <mat-tab-group mat-stretch-tabs="false" animationDuration="0ms" [(selectedIndex)]="tabIndex">
        <mat-tab [label]="'customers.tabs.profile' | t">
          <div class="tab-body"><app-customer-profile-tab [customer]="c" /></div>
        </mat-tab>
        <mat-tab [label]="('customers.tabs.contacts' | t) + ' (' + c.contacts.length + ')'">
          <div class="tab-body"><app-customer-contacts [customer]="c" (customerChange)="customer.set($event)" /></div>
        </mat-tab>
        <mat-tab [label]="'customers.tabs.notes' | t">
          <ng-template matTabContent><div class="tab-body"><app-customer-notes [customerId]="c.id" /></div></ng-template>
        </mat-tab>
        <mat-tab [label]="'customers.tabs.attachments' | t">
          <ng-template matTabContent><div class="tab-body"><app-customer-attachments [customerId]="c.id" /></div></ng-template>
        </mat-tab>
        <mat-tab [label]="'customers.tabs.history' | t">
          <ng-template matTabContent><div class="tab-body"><app-customer-history [customerId]="c.id" /></div></ng-template>
        </mat-tab>
      </mat-tab-group>
    } @else {
      <app-loading />
    }
  `,
  styles: `
    .badges { display: inline-flex; align-items: center; gap: 8px; margin-inline-end: 8px; }
    .danger-item { color: var(--crm-danger); }
    .danger-item mat-icon { color: inherit; }
    mat-tab-group { margin-block-start: 8px; }
    .tab-body { padding-block: 16px; }
  `,
})
export class CustomerDetailsPage {
  private readonly api = inject(CustomersApi);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(NotificationToastService);
  private readonly translations = inject(TranslationService);
  private readonly permissionService = inject(PermissionService);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;

  /** Route parameter. */
  readonly id = input.required<string>();

  readonly permissions = Permissions;
  readonly customer = signal<Customer | null>(null);
  readonly error = signal<string | null>(null);
  readonly tabIndex = signal(0);
  readonly hasMoreActions = computed(() => this.permissionService.hasAny([Permissions.customersUpdate, Permissions.customersDelete]));

  constructor() {
    // Reload when the route parameter changes (e.g. following a duplicate link).
    effect(() => {
      this.id();
      untracked(() => {
        this.customer.set(null);
        this.tabIndex.set(0);
        this.load();
      });
    });
  }

  load(): void {
    this.error.set(null);
    this.request?.unsubscribe();
    this.request = this.api
      .get(this.id(), { silent: true })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (customer) => this.customer.set(customer),
        error: (error: unknown) => this.error.set(describeError(ApiError.from(error), this.translations)),
      });
  }

  grantPortal(customer: Customer): void {
    const data: PortalAccessDialogData = {
      customerId: customer.id,
      email: customer.contacts.find((c) => c.type === 'Email' && c.isPrimary)?.value ?? customer.contacts.find((c) => c.type === 'Email')?.value ?? '',
    };
    this.dialog
      .open(PortalAccessDialogComponent, { data, width: '480px', maxWidth: '95vw', direction: this.translations.direction() })
      .afterClosed()
      .subscribe((granted: unknown) => {
        if (granted === true) {
          this.toast.success('customers.portal.granted');
          this.load();
        }
      });
  }

  revokePortal(customer: Customer): void {
    this.confirm
      .ask({ title: 'customers.portal.revokeTitle', message: 'customers.portal.revokeMessage', params: { name: customer.name }, destructive: true, confirmText: 'customers.portal.revoke' })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.api.revokePortalAccess(customer.id).subscribe({
          next: () => {
            this.toast.success('customers.portal.revoked');
            this.load();
          },
        });
      });
  }

  remove(customer: Customer): void {
    this.confirm
      .ask({ title: 'customers.details.deleteTitle', message: 'customers.details.deleteMessage', params: { name: customer.name }, destructive: true, confirmText: 'core.actions.delete' })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.api.delete(customer.id).subscribe({
          next: () => {
            this.toast.success('customers.details.deleted');
            void this.router.navigate(['/customers']);
          },
        });
      });
  }
}
