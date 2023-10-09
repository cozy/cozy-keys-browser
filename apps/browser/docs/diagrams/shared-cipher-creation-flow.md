sequenceDiagram;
title: Creation of a shared cipher

participant U as User
participant P as Pass
participant S as Stack
participant H as Harvest

U-->>P: Create cipher
P-->>P: Encrypt cipher
P-->>S: Save encrypted cipher
S-->>P: Get konnectors
P-->>P: Create konnector suggestion
P-->>S: Save konnector suggestion

U-->>U: Open Cozy Home

H-->>U: Suggest konnector

U-->>H: Create konnector
H-->>H: Encrypt credentials for account
H-->>H: Re-encrypt cipher with cozy org key
H-->>H: Create account->cipher relationship
H-->>H: Set cipher in cozy org

H-->>S: Save account
H-->>S: Save trigger
H-->>S: Save encrypted cipher
