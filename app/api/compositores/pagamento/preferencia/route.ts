import { NextResponse } from 'next/server'
import { preferenceClient, getReturnUrls } from '@/lib/mercadopago'
import { supabaseAdmin } from '@/lib/supabase'
import * as db from '@/lib/db'
import { sendMetaInitiateCheckoutEvent } from '@/lib/meta-conversions'

export async function POST(request: Request) {
  try {
    // Verificar se token está configurado
    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
      console.error('[PREFERENCIA] MERCADOPAGO_ACCESS_TOKEN não configurado!')
      return NextResponse.json(
        { error: 'Configuração do Mercado Pago não encontrada. Entre em contato com o suporte.' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { composerId, planId } = body

    console.log('[PREFERENCIA] Recebida requisição:', { composerId, planId })

    if (!composerId || !planId) {
      return NextResponse.json(
        { error: 'Compositor ID e Plano ID são obrigatórios' },
        { status: 400 }
      )
    }

    // Buscar plano (planId pode ser slug ou id)
    let plan = await db.getPlanBySlug(planId)
    if (!plan) {
      // Tentar buscar por ID
      const { data: planData, error: planError } = await supabaseAdmin
        .from('dccmusic_plans')
        .select('*')
        .eq('id', planId)
        .eq('is_active', true)
        .single()
      if (planData && !planError) {
        plan = db.mapPlan(planData)
      }
    }
    
    if (!plan) {
      return NextResponse.json(
        { error: 'Plano não encontrado' },
        { status: 404 }
      )
    }

    // Buscar compositor (composerId pode ser slug ou id)
    let composer = await db.getComposerBySlug(composerId)
    if (!composer) {
      // Tentar buscar por ID
      const { data: composerData, error: composerError } = await supabaseAdmin
        .from('dccmusic_composers')
        .select('*')
        .eq('id', composerId)
        .single()
      if (composerData && !composerError) {
        composer = db.mapComposer(composerData)
      }
    }
    
    if (!composer) {
      return NextResponse.json(
        { error: 'Compositor não encontrado' },
        { status: 404 }
      )
    }

    // Buscar email do compositor
    const { data: composerWithEmail } = await supabaseAdmin
      .from('dccmusic_composers')
      .select('email')
      .eq('id', composer.id)
      .single()
    
    const composerEmail = composerWithEmail?.email || ''

    // Usar função SQL que busca ou cria assinatura (bypassa RLS e evita duplicatas)
    console.log('[PREFERENCIA] Buscando ou criando assinatura usando função SQL...', {
      composerId: composer.id,
      planId: plan.id,
    })

    let subscription: any = null

    // Tentar usar função get_or_create_complete primeiro (retorna JSON completo)
    const { data: subscriptionJson, error: getOrCreateCompleteError } = await supabaseAdmin.rpc(
      'dccmusic_get_or_create_subscription_complete',
      {
        p_composer_id: composer.id,
        p_plan_id: plan.id,
        p_status: 'pending',
      }
    )

    if (!getOrCreateCompleteError && subscriptionJson) {
      // Função completa retornou JSON com todos os dados
      subscription = subscriptionJson
      console.log('[PREFERENCIA] Assinatura obtida via função completa:', subscription.id)
    } else {
      // Fallback: tentar função que retorna apenas ID
      console.log('[PREFERENCIA] Função completa não disponível, tentando função ID...')
      
      const { data: subscriptionId, error: getOrCreateError } = await supabaseAdmin.rpc(
        'dccmusic_get_or_create_subscription',
        {
          p_composer_id: composer.id,
          p_plan_id: plan.id,
          p_status: 'pending',
        }
      )

      if (getOrCreateError) {
        console.error('[PREFERENCIA] Erro ao chamar função get_or_create:', getOrCreateError)
        
        // Se função não existir, tentar função create
        if (getOrCreateError.message?.includes('function') || getOrCreateError.code === '42883') {
          console.log('[PREFERENCIA] Função get_or_create não encontrada, tentando create...')
          
          const { data: subscriptionResult, error: functionError } = await supabaseAdmin.rpc(
            'dccmusic_create_subscription',
            {
              p_composer_id: composer.id,
              p_plan_id: plan.id,
              p_status: 'pending',
            }
          )

          if (functionError) {
            console.error('[PREFERENCIA] Erro ao chamar função create:', functionError)
            
            // Se for erro de duplicata, buscar a assinatura existente usando função SQL
            if (functionError.code === '23505' || functionError.message?.includes('duplicate key')) {
              console.log('[PREFERENCIA] Assinatura já existe (duplicata), buscando via função...')
              
              // Tentar buscar usando função get_or_create novamente (pode ter sido criada entre as chamadas)
              const { data: retryId } = await supabaseAdmin.rpc(
                'dccmusic_get_or_create_subscription',
                {
                  p_composer_id: composer.id,
                  p_plan_id: plan.id,
                  p_status: 'pending',
                }
              )
              
              if (retryId) {
                const subscriptionIdToUse = retryId as string
                const { data: subscriptionData, error: fetchError } = await supabaseAdmin
                  .from('dccmusic_subscriptions')
                  .select('*')
                  .eq('id', subscriptionIdToUse)
                  .limit(1)

                if (subscriptionData && subscriptionData.length > 0 && !fetchError) {
                  subscription = subscriptionData[0]
                  console.log('[PREFERENCIA] Assinatura encontrada após retry:', subscription.id)
                }
              }
              
              // Se ainda não encontrou, tentar busca direta
              if (!subscription) {
                const { data: existingSub, error: fetchExistingError } = await supabaseAdmin
                  .from('dccmusic_subscriptions')
                  .select('*')
                  .eq('composer_id', composer.id)
                  .eq('plan_id', plan.id)
                  .eq('status', 'pending')
                  .order('created_at', { ascending: false })
                  .limit(1)

                if (existingSub && existingSub.length > 0 && !fetchExistingError) {
                  subscription = existingSub[0]
                  console.log('[PREFERENCIA] Assinatura existente encontrada (busca direta):', subscription.id)
                } else {
                  return NextResponse.json(
                    { 
                      error: 'Erro ao buscar assinatura existente',
                      details: fetchExistingError?.message || functionError.message 
                    },
                    { status: 500 }
                  )
                }
              }
            } else {
              return NextResponse.json(
                { 
                  error: 'Erro ao criar assinatura. Execute o SQL-FUNCAO-GET-OR-CREATE-SUBSCRIPTION.sql no Supabase.',
                  details: functionError.message 
                },
                { status: 500 }
              )
            }
          } else if (subscriptionResult) {
            // Função create funcionou, buscar assinatura completa
            const subscriptionIdFromCreate = subscriptionResult as string
            console.log('[PREFERENCIA] Assinatura criada via função create:', subscriptionIdFromCreate)

            const { data: subscriptionData, error: fetchError } = await supabaseAdmin
              .from('dccmusic_subscriptions')
              .select('*')
              .eq('id', subscriptionIdFromCreate)
              .limit(1)

            if (subscriptionData && subscriptionData.length > 0 && !fetchError) {
              subscription = subscriptionData[0]
            } else {
              console.error('[PREFERENCIA] Erro ao buscar assinatura criada:', fetchError)
              return NextResponse.json(
                { error: 'Erro ao buscar assinatura criada' },
                { status: 500 }
              )
            }
          } else {
            return NextResponse.json(
              { 
                error: 'Erro ao criar assinatura. Execute o SQL-FUNCAO-GET-OR-CREATE-SUBSCRIPTION.sql no Supabase.',
                details: 'Nenhum resultado retornado'
              },
              { status: 500 }
            )
          }
        } else {
          return NextResponse.json(
            { 
              error: 'Erro ao buscar ou criar assinatura. Execute o SQL-FUNCAO-GET-OR-CREATE-SUBSCRIPTION-COMPLETA.sql no Supabase.',
              details: getOrCreateError.message 
            },
            { status: 500 }
          )
        }
      } else if (subscriptionId) {
        // Função get_or_create funcionou, buscar assinatura completa
        const subscriptionIdFromGetOrCreate = subscriptionId as string
        console.log('[PREFERENCIA] Assinatura obtida via função get_or_create:', subscriptionIdFromGetOrCreate)

        // Tentar buscar usando limit(1) em vez de single() para evitar problemas com RLS
        const { data: subscriptionDataArray, error: fetchError } = await supabaseAdmin
          .from('dccmusic_subscriptions')
          .select('*')
          .eq('id', subscriptionIdFromGetOrCreate)
          .limit(1)

        if (subscriptionDataArray && subscriptionDataArray.length > 0 && !fetchError) {
          subscription = subscriptionDataArray[0]
          console.log('[PREFERENCIA] Assinatura encontrada:', subscription.id)
        } else {
          console.error('[PREFERENCIA] Erro ao buscar assinatura:', fetchError)
          console.error('[PREFERENCIA] Tentando buscar sem filtro de ID...')
          
          // Fallback: buscar todas as assinaturas pendentes do compositor
          const { data: allSubscriptions, error: fallbackError } = await supabaseAdmin
            .from('dccmusic_subscriptions')
            .select('*')
            .eq('composer_id', composer.id)
            .eq('plan_id', plan.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(1)

          if (allSubscriptions && allSubscriptions.length > 0 && !fallbackError) {
            subscription = allSubscriptions[0]
            console.log('[PREFERENCIA] Assinatura encontrada via fallback:', subscription.id)
          } else {
            return NextResponse.json(
              { 
                error: 'Erro ao buscar assinatura',
                details: fetchError?.message || fallbackError?.message || 'Assinatura não encontrada',
                subscriptionId: subscriptionIdFromGetOrCreate
              },
              { status: 500 }
            )
          }
        }
      } else {
        // Se chegou aqui sem subscription e sem erro, algo deu errado
        const errorMsg = getOrCreateError 
          ? (getOrCreateError as any).message || 'Erro desconhecido'
          : getOrCreateCompleteError
          ? (getOrCreateCompleteError as any).message || 'Erro desconhecido'
          : 'Erro desconhecido'
        
        return NextResponse.json(
          { 
            error: 'Erro ao buscar ou criar assinatura. Execute o SQL-FUNCAO-GET-OR-CREATE-SUBSCRIPTION-COMPLETA.sql no Supabase.',
            details: errorMsg
          },
          { status: 500 }
        )
      }
    }

    if (!subscription) {
      return NextResponse.json(
        { error: 'Erro ao criar ou buscar assinatura' },
        { status: 500 }
      )
    }

    console.log('[PREFERENCIA] Assinatura pronta para uso:', subscription.id)

    // Criar preferência de pagamento no Mercado Pago
    const returnUrls = getReturnUrls(subscription.id)
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000'

    console.log('[PREFERENCIA] Criando preferência no Mercado Pago...', {
      planId: plan.id,
      planName: plan.name,
      planPrice: plan.price,
      composerEmail: composerEmail,
      subscriptionId: subscription.id,
    })

    const preference = await preferenceClient.create({
      body: {
        // Itens do pagamento
        items: [
          {
            id: plan.id,
            title: plan.name,
            description: plan.description || `Assinatura ${plan.name} - DCC Music`,
            quantity: 1,
            unit_price: plan.price,
            currency_id: 'BRL',
          },
        ],
        
        // Informações do pagador
        payer: {
          email: composerEmail,
        },
        
        // URLs de retorno após o pagamento
        back_urls: {
          success: returnUrls.success,
          failure: returnUrls.failure,
          pending: returnUrls.pending,
        },
        
        // Configurações de retorno automático
        auto_return: 'approved', // Redireciona automaticamente quando aprovado
        
        // Referência externa (ID da assinatura)
        external_reference: subscription.id,
        
        // URL para receber notificações de pagamento (webhook)
        notification_url: `${baseUrl}/api/compositores/pagamento/webhook`,
        
        // Descrição que aparece na fatura do cartão
        statement_descriptor: 'DCC Music',
        
        // Metadados adicionais
        metadata: {
          composer_id: composer.id,
          composer_name: composer.name,
          plan_id: plan.id,
          plan_name: plan.name,
          subscription_id: subscription.id,
        },
        
        // Configurações de pagamento
        payment_methods: {
          excluded_payment_types: [], // Aceita todos os tipos
          excluded_payment_methods: [], // Aceita todos os métodos
          installments: 12, // Permite parcelamento até 12x
        },
        
        // Modo binário: true = só aceita pagamentos aprovados ou rejeitados (sem pendentes)
        binary_mode: false, // Mantém false para aceitar pagamentos pendentes também
        
        // Data de expiração da preferência (24 horas)
        expires: true,
        expiration_date_from: new Date().toISOString(),
        expiration_date_to: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
        
        // Configurações adicionais
        additional_info: `Assinatura anual para compositor ${composer.name} no DCC Music`,
      },
    })

    console.log('[PREFERENCIA] Preferência criada com sucesso:', {
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
    })

    // Atualizar assinatura com payment_id usando função SQL
    const { error: updateError } = await supabaseAdmin.rpc(
      'dccmusic_update_subscription_payment_id',
      {
        p_subscription_id: subscription.id,
        p_payment_id: preference.id,
      }
    )

    // Fallback para método direto se função não existir
    if (updateError && updateError.message?.includes('function')) {
      const { error: directUpdateError } = await supabaseAdmin
        .from('dccmusic_subscriptions')
        .update({
          payment_id: preference.id,
        })
        .eq('id', subscription.id)
      
      if (directUpdateError) {
        console.error('[PREFERENCIA] Erro ao atualizar assinatura com payment_id:', directUpdateError)
      }
    } else if (updateError) {
      console.error('[PREFERENCIA] Erro ao atualizar assinatura com payment_id:', updateError)
      // Não falha a requisição, apenas loga o erro
    }

    const metaInitiateCheckoutEventId = `initiate_checkout:${preference.id}`
    await sendMetaInitiateCheckoutEvent({
      request,
      eventId: metaInitiateCheckoutEventId,
      eventSourceUrl: request.headers.get('referer') || request.url,
      email: composerEmail,
      externalId: composer.id,
      value: Number(plan.price) || 0,
      currency: 'BRL',
      contentName: plan.name,
      contentId: plan.id,
      quantity: 1,
    }).catch((metaError) => {
      console.error('[PREFERENCIA] Erro ao enviar início de checkout para Meta:', metaError)
    })

    return NextResponse.json({
      success: true,
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
      subscriptionId: subscription.id,
      planId: plan.id,
      planName: plan.name,
      planPrice: Number(plan.price) || 0,
      metaInitiateCheckoutEventId,
    })
  } catch (error: any) {
    console.error('[PREFERENCIA] Erro ao criar preferência de pagamento:', error)
    console.error('[PREFERENCIA] Stack:', error.stack)
    console.error('[PREFERENCIA] Detalhes:', {
      message: error.message,
      cause: error.cause,
      name: error.name,
    })
    
    // Mensagem de erro mais amigável
    let errorMessage = 'Erro ao criar preferência de pagamento'
    
    if (error.message?.includes('Invalid access_token') || error.message?.includes('401')) {
      errorMessage = 'Token do Mercado Pago inválido. Verifique as configurações.'
    } else if (error.message?.includes('Invalid')) {
      errorMessage = `Erro na configuração: ${error.message}`
    } else if (error.message) {
      errorMessage = error.message
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
