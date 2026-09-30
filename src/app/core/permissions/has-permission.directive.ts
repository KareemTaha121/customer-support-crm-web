import { Directive, TemplateRef, ViewContainerRef, effect, inject, input } from '@angular/core';
import { PermissionService } from './permission.service';

/**
 * Renders its template only when the user holds the permission (or any of the list):
 * `<button *appHasPermission="'tickets.assign'">`, `<div *appHasPermission="['a', 'b']">`.
 * Hiding is a UX aid; the API still enforces every permission.
 */
@Directive({ selector: '[appHasPermission]' })
export class HasPermissionDirective {
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private readonly permissions = inject(PermissionService);
  private rendered = false;

  readonly appHasPermission = input.required<string | readonly string[]>();

  constructor() {
    effect(() => {
      const required = this.appHasPermission();
      const allowed = this.permissions.hasAny(typeof required === 'string' ? [required] : required);
      if (allowed && !this.rendered) {
        this.container.createEmbeddedView(this.template);
        this.rendered = true;
      } else if (!allowed && this.rendered) {
        this.container.clear();
        this.rendered = false;
      }
    });
  }
}
