sequenceDiagram;
title: Soft delete of a shared cipher

participant U as User
participant P as Pass
participant S as Stack
participant H as Harvest

U-->>P: Delete shared cipher
P-->>P: Put the cipher in trash
note right of P: set deletedDate
P-->>S: Save encrypted cipher
S-->>S: Detect soft delete 
S-->>H: Launch service 

H-->>H: Decrypt shared cipher
S-->>H: Get account + konnector + trigger
H-->>H: Remove account credentials
H-->>S: Save account
H-->>S: Delete trigger
