const NotificationQueueMessageType = {
  TotpCopied: "totp-copied",
  AddLogin: "add",
  ChangePassword: "change",
  UnlockVault: "unlock",
  RequestFilelessImport: "fileless-import",
} as const;

type NotificationQueueMessageTypes =
  (typeof NotificationQueueMessageType)[keyof typeof NotificationQueueMessageType];

export { NotificationQueueMessageType, NotificationQueueMessageTypes };
