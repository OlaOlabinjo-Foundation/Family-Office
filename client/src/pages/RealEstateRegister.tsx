import { RegisterCrudPage } from './RegisterCrudPage'
import { REAL_ESTATE_SCHEMA } from '../lib/registerSchemas'

export function RealEstateRegister() {
  return <RegisterCrudPage schema={REAL_ESTATE_SCHEMA} />
}
