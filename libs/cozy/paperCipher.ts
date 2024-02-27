/* eslint-disable no-console */
// Cozy customization
import { Q } from 'cozy-client'
import CozyClient from 'cozy-client/types/CozyClient';

import { CipherType } from '@bitwarden/common/vault/enums/cipher-type';
import { CipherResponse } from '@bitwarden/common/vault/models/response/cipher.response';
import { CipherView } from '@bitwarden/common/vault/models/view/cipher.view';

const fetchPapers = async (client: CozyClient) => {
  const filesQueryByLabels = buildFilesQueryWithQualificationLabel();

  const data = await client.queryAll(filesQueryByLabels.definition(), filesQueryByLabels.options);

  return data;
}

export const buildFilesQueryWithQualificationLabel = () => {
  const select = [
    'name',
    'mime',
    'referenced_by',
    'metadata.country',
    'metadata.datetime',
    'metadata.expirationDate',
    'metadata.noticePeriod',
    'metadata.qualification.label',
    'metadata.referencedDate',
    'metadata.number',
    'metadata.contractType',
    'metadata.refTaxIncome',
    'metadata.title',
    'metadata.version',
    'cozyMetadata.createdByApp',
    'created_at',
    'dir_id',
    'updated_at',
    'type',
    'trashed'
  ]

  return {
    definition: () =>
      Q('io.cozy.files')
        .where({
          type: 'file',
          trashed: false
        })
        .partialIndex({
          'metadata.qualification.label': {
            $exists: true
          },
          'cozyMetadata.createdByApp': { $exists: true }
        })
        .select(select)
        .limitBy(1000)
        .indexFields(['type', 'trashed']),
    options: {
      as: `io.cozy.files/metadata_qualification_label`
    }
  }
}


const convertPapersAsCiphers = async (cipherService: any, papers: any): Promise<CipherResponse[]> => {
  const papersCiphers = []

  for (const paper of papers) {
    const cipherView = new CipherView()
    cipherView.id = paper.id
    cipherView.name = paper.name
    cipherView.type = CipherType.Paper

    const cipherEncrypted = await cipherService.encrypt(cipherView)
    const cipherViewEncrypted = new CipherView(cipherEncrypted)
    const cipherViewResponse = new CipherResponse(cipherViewEncrypted)
    cipherViewResponse.id = cipherEncrypted.id
    cipherViewResponse.name = cipherEncrypted.name.encryptedString
    cipherViewResponse.fields = []

    papersCiphers.push(cipherViewResponse)
  }

  return papersCiphers;
}

export const fetchPapersAndConvertAsCiphers = async (cipherService: any, cozyClientService: any): Promise<CipherResponse[]> => {
  const client = await cozyClientService.getClientInstance();

  try {
    const papers = await fetchPapers(client);

    const papersCiphers = await convertPapersAsCiphers(cipherService, papers)

    console.log(`${papersCiphers.length} papers ciphers will be added`)

    return papersCiphers
  } catch (e) {
    console.log('Error while fetching papers and converting them as ciphers', e)

    throw e
  }
}
// Cozy customization end
