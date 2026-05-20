import { RegisterCrudPage } from './RegisterCrudPage'
import { PUBLIC_SECURITIES_SCHEMA } from '../lib/registerSchemas'

export function PublicSecuritiesRegister() {
  return <RegisterCrudPage schema={PUBLIC_SECURITIES_SCHEMA} />
}
