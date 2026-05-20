import { RegisterCrudPage } from './RegisterCrudPage'
import { CASH_BANKING_SCHEMA } from '../lib/registerSchemas'

export function CashBankingRegister() {
  return <RegisterCrudPage schema={CASH_BANKING_SCHEMA} />
}
