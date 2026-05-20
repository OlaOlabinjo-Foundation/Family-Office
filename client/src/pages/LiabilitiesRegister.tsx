import { RegisterCrudPage } from './RegisterCrudPage'
import { LIABILITIES_SCHEMA } from '../lib/registerSchemas'

export function LiabilitiesRegister() {
  return <RegisterCrudPage schema={LIABILITIES_SCHEMA} />
}
