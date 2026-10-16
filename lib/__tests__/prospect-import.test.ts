import { describe, it, expect } from 'vitest'
import { parseProspectRows, personalizeProspect } from '../prospect-import'
describe('prospect import',()=>{
 it('finds accented headers after introductory rows and deduplicates normalized emails',()=>{
  const r=parseProspectRows([['Minha lista'],['Nome completo','E-mail'],['Marina Silva',' TESTE@example.com '],['Outro','teste@example.com'],['Sem','inválido']])
  expect(r.contacts).toEqual([{email:'teste@example.com',name:'Marina Silva'}]);expect(r.duplicates).toBe(1);expect(r.invalid).toBe(1)
 })
 it('detects a headerless column by its email values without losing first row',()=>{
  expect(parseProspectRows([['x','a@example.com'],['y','b@example.com']]).contacts).toHaveLength(2)
 })
 it('rejects missing email columns',()=>{expect(()=>parseProspectRows([['Nome'],['Marina']])).toThrow()})
 it('supports both placeholders and a neutral missing-name greeting',()=>{
  expect(personalizeProspect('Oi {nome}, {{nome}}','Marina Silva')).toBe('Oi Marina, Marina')
  expect(personalizeProspect('Olá, {nome}!','')).toBe('Olá, tudo bem!')
 })
 it('handles more than 1000 rows without truncation',()=>{
  expect(parseProspectRows([['mail'],...Array.from({length:2401},(_,i)=>[`p${i}@example.com`])]).contacts).toHaveLength(2401)
 })
})
