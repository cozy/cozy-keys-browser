sequenceDiagram;
title: Restore of a shared cipher

participant U as User
participant P as Pass
participant S as Stack
participant H as Harvest

U-->>P: Restore shared cipher
P-->>P: Retrieve the cipher from trash
note right of P: remove deletedDate
P-->>S: Save encrypted cipher
S-->>S: Detect restore 
S-->>H: Launch service 

H-->>H: Decrypt cipher
S-->>H: Get account + konnector
H-->>H: Restore encrypted credentials for account
H-->>S: Save account
H-->>S: Save trigger
