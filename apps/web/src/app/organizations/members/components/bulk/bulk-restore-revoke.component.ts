import { Component } from "@angular/core";

import { ModalConfig } from "@bitwarden/angular/services/modal.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { OrganizationUserService } from "@bitwarden/common/abstractions/organization-user/organization-user.service";

import { BulkUserDetails } from "./bulk-status.component";

@Component({
  selector: "app-bulk-restore-revoke",
  templateUrl: "bulk-restore-revoke.component.html",
})
export class BulkRestoreRevokeComponent {
  isRevoking: boolean;
  organizationId: string;
  users: BulkUserDetails[];

  statuses: Map<string, string> = new Map();

  loading = false;
  done = false;
  error: string;

  constructor(
    protected i18nService: I18nService,
    private organizationUserService: OrganizationUserService,
    config: ModalConfig
  ) {
    this.isRevoking = config.data.isRevoking;
    this.organizationId = config.data.organizationId;
    this.users = config.data.users;
  }

  get bulkTitle() {
    const titleKey = this.isRevoking ? "revokeUsers" : "restoreUsers";
    return this.i18nService.t(titleKey);
  }

  async submit() {
    this.loading = true;
    try {
      const response = await this.performBulkUserAction();

      const bulkMessage = this.isRevoking ? "bulkRevokedMessage" : "bulkRestoredMessage";
      response.data.forEach((entry) => {
        const error = entry.error !== "" ? entry.error : this.i18nService.t(bulkMessage);
        this.statuses.set(entry.id, error);
      });
      this.done = true;
    } catch (e) {
      this.error = e.message;
    }

    this.loading = false;
  }

  protected async performBulkUserAction() {
    const userIds = this.users.map((user) => user.id);
    if (this.isRevoking) {
      return await this.organizationUserService.revokeManyOrganizationUsers(
        this.organizationId,
        userIds
      );
    } else {
      return await this.organizationUserService.restoreManyOrganizationUsers(
        this.organizationId,
        userIds
      );
    }
  }
}
