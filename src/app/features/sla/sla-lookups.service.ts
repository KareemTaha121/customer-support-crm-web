import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import { TranslationService } from '../../core/localization/translation.service';
import { SlaApi } from './sla.api';
import { BranchResponse, DepartmentOption, TicketCategoryOption, UserLookup } from './sla.models';

/** Picker data (categories, departments, user names) shared by the SLA pages and dialogs. */
@Injectable({ providedIn: 'root' })
export class SlaLookupsService {
  private readonly api = inject(SlaApi);
  private readonly translations = inject(TranslationService);
  private loading = false;
  private loaded = false;

  private readonly rawCategories = signal<TicketCategoryOption[]>([]);
  private readonly users = signal<ReadonlyMap<string, string>>(new Map());

  readonly departments = signal<DepartmentOption[]>([]);

  /** Categories with a localized label, children shown as `Parent › Child`. */
  readonly categories = computed(() => {
    const arabic = this.translations.language() === 'ar';
    const all = this.rawCategories();
    const label = (c: TicketCategoryOption): string => (arabic && c.nameAr ? c.nameAr : c.name);
    const byId = new Map(all.map((c) => [c.id, c]));
    return all
      .map((c) => {
        const parent = c.parentId ? byId.get(c.parentId) : undefined;
        return { id: c.id, isActive: c.isActive, label: parent ? `${label(parent)} › ${label(c)}` : label(c) };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  ensureLoaded(): void {
    if (this.loaded || this.loading) {
      return;
    }
    this.loading = true;
    forkJoin({
      categories: this.api.categories().pipe(catchError(() => of<TicketCategoryOption[] | null>(null))),
      branches: this.api.branches().pipe(catchError(() => of<BranchResponse[] | null>(null))),
      users: this.api.lookupUsers().pipe(catchError(() => of<UserLookup[]>([]))),
    }).subscribe(({ categories, branches, users }) => {
      this.loading = false;
      this.loaded = categories !== null && branches !== null;
      this.rawCategories.set(categories ?? []);
      this.departments.set(
        (branches ?? []).flatMap((b) =>
          b.departments.map((d) => ({ id: d.id, label: `${b.name} — ${d.name}`, isActive: d.isActive && b.isActive })),
        ),
      );
      this.remember(users);
    });
  }

  remember(users: readonly UserLookup[]): void {
    if (users.length === 0) {
      return;
    }
    const next = new Map(this.users());
    for (const user of users) {
      next.set(user.id, user.displayName);
    }
    this.users.set(next);
  }

  rememberName(id: string | null, name: string | null): void {
    if (id && name && this.users().get(id) !== name) {
      this.users.set(new Map(this.users()).set(id, name));
    }
  }

  categoryName(id: string | null): string | null {
    return id ? (this.categories().find((c) => c.id === id)?.label ?? null) : null;
  }

  departmentName(id: string | null): string | null {
    return id ? (this.departments().find((d) => d.id === id)?.label ?? null) : null;
  }

  userName(id: string | null): string | null {
    return id ? (this.users().get(id) ?? null) : null;
  }
}
