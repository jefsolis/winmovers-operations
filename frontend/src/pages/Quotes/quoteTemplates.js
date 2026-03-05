export const SECTION_KEYS = [
  'clientInfo',
  'salutation',
  'originPackingServices',
  'customsPaperWork',
  'internationalFreight',
  'destinationServices',
  'price',
  'serviceSchedule',
  'exclusions',
  'goodbye',
]

export const SECTION_UI_LABELS = {
  EN: {
    clientInfo:             'Client Information',
    salutation:             'Salutation',
    originPackingServices:  'Origin Packing Services',
    customsPaperWork:       'Customs Paperwork for Exportation',
    internationalFreight:   'International Freight',
    destinationServices:    'Destination Services',
    price:                  'Price & Conditions',
    serviceSchedule:        'Service Schedule',
    exclusions:             'Exclusions',
    goodbye:                'Closing',
  },
  ES: {
    clientInfo:             'Información del Cliente',
    salutation:             'Saludo',
    originPackingServices:  'Servicios de Embalaje en Origen',
    customsPaperWork:       'Trámite Aduanal de Exportación',
    internationalFreight:   'Flete Internacional',
    destinationServices:    'Servicios de Destino',
    price:                  'Costos y Condiciones',
    serviceSchedule:        'Cronograma de Servicios',
    exclusions:             'Exclusiones',
    goodbye:                'Cierre',
  },
}

export const SERVICE_TYPE_LABELS = {
  EN: {
    PORT_TO_PORT: 'Door to Port',
    DOOR_TO_DOOR: 'Door to Door',
    PACKING:      'Packing',
    LOCAL_MOVE:   'Local Moving',
  },
  ES: {
    PORT_TO_PORT: 'Puerta a Puerto',
    DOOR_TO_DOOR: 'Puerta a Puerta',
    PACKING:      'Empaque',
    LOCAL_MOVE:   'Mudanza Local',
  },
}

export const TEMPLATES = {
  EN: {
    clientInfo: `Date: [Date]\n\nMr. (s) [Client Name]\n[Company]`,

    salutation: `Dear Mr, Mrs, Ms:\nWe would like to thank you for giving us the opportunity to offer our [Service Type] service to transport your household goods and personal and effects from [Origin] to [Destiny].\n\nFollowing a detail of the services we are offering:`,

    originPackingServices: `**Origin Packing Services**\n\n-Packing professionals will do the packing at your residence using excellent materials such as bubble wrap, white paper, corrugated carton, as well as special packing boxes for crystal, dishes, and decoration items, books, clothes, etc.\n-Special wood boxes will be made for safer transportation of fragile objects such as artwork, marble, glass and mirrors if necessary.\n-There will always be personal supervision.\n-You can count with a 30-day free storage service at our warehouse if you need it.\n-Packing list preparation.\n-Once the packing is done everything will be placed inside the container which will be located next or across your residence.`,

    customsPaperWork: `**Customs Paper Work For Exportation**\n\n-We fill out customs forms for your household goods to comply with the authorities in [Destiny] and their clearance. For this we will need a copy of your passport.`,

    internationalFreight: `**International (OCEAN, AIR, LAND) Freight**\n\nWe will coordinate the [Service Type] freight in a container of _____ (Type of container) from your residence in [Origin] to [Destiny].`,

    destinationServices: `**Destination Services**\n\n-Our agent ________ (Company Name) in [Destiny] will handle customs paper work to clear the cargo, bring the container into a bonded warehouse and returning it empty to the steamship line and then taking the cargo from customs warehouse to your residence, unload and unpack to place it in your new residence. We will also remove all unpacking waste.`,

    price: `**Costs and Conditions**\n\nOur Door to Door service rate by [Service Type] is [Currency][Price]. We have based this fee on a ______ cubic meters in an exclusive _____ feet container.`,

    serviceSchedule: `Valid offer: [Quote Valid Days].\nMethod of payment: Before Shipping / 30 days.\n\nInsurance: Additionally we offer a Door to Door insurance with the company Pac Global with coverage of 3.5% over the declared value of the shipment.`,

    exclusions: `**Exclusions**\nOur rates Excludes: Terminal handling charge (THC), government inspections, storage charges, customs exam fees, x-ray examination, custom duties / import taxes, demurrage charges at destination, hoisting, long carry, shuttle service or any other cost not mentioned before.`,

    goodbye: `We would like to thank you the opportunity that you give us to present to you our offer. I'm at your service to clarify any questions.\n\nSincerely,\n\n\n[Quote Creator]\n\n______________________________\nAcceptance signature and date`,
  },

  ES: {
    clientInfo: `Fecha: [Date]\n\nSeñor (a) [Client Name]\n[Company]`,

    salutation: `Estimado (a) [Client Name]\nDe acuerdo a su solicitud con mucho gusto le presentamos nuestra cotización para el traslado del menaje de casa, y efectos personales del Sr [Client Name] ofreciéndoles el servicio de [Service Type].\n\nORIGEN [Origin]\nDESTINO [Destiny]`,

    originPackingServices: `**Detalle de los servicios de embalaje que le brindaremos**\n\n**Servicio de Empaque:**\n- El embalaje se realizará en la residencia con empacadores profesionales, quienes utilizan materiales nuevos tales como plástico con burbujas, papel blanco, estereofón, cartón corrugado, además de cajas especiales para el embalaje (empaque) de cristalería, loza, adornos, libros, ropa, etc.\n-Se confeccionarán cajas especiales de madera para brindar mayor seguridad a los artículos frágiles tales como cuadros, mármol, vidrios y espejos.\n-Habrá supervisión del servicio que se está brindando.\n-Preparación de lista de empaque.\n-Una vez finalizado el embalaje se acondicionarán los bultos dentro del contenedor, que estará ubicado frente o contiguo a su residencia.`,

    customsPaperWork: `**Trámite de aduana para la Exportación**\n-Se realizarán los trámites para cumplir con las formalidades aduaneras de exportación para el menaje de casa en la aduana de salida. Para realizar este trámite se le estará solicitando la documentación necesaria.`,

    internationalFreight: `**Flete marítimo internacional exclusivo**\n\nCoorinaremos el flete marítimo internacional exclusivo en contenedor de xxx pies desde xxx hasta puerto xxx con salidas cada xx días y un tiempo de transito de aprox. xx días.`,

    destinationServices: `**Servicios de Destino**\n\nA la llegada del embarque nuestro corresponsal realizara los siguientes servicios:\n-Trámites de aduana para la nacionalización del embarque\n-Traslado del embarque a la nueva residencia\n-Descarga, desempaque, apertura de cajas de madera, armado de camas y acomodo de todos los artículos\n-Retiro de los materiales de empaque usados.`,

    price: `**Costos y Condiciones**\n\nLa tarifa por los servicios antes mencionados de Puerta a Puerta incluyendo el THC es de [Currency][Price]. Hemos estimado nuestra tarifa en un embarque de 70 metros cúbicos despachados en un contenedor de 40 pies HC.`,

    serviceSchedule: `**Cronograma de Servicios:**\n-El empaque tendrá una duración de xx días, el tiempo de transito será de xx días, el tiempo de desalmacenaje es de xx días y la duración del empaque será de xx días\n\nOfrecemos seguro de Puerta a Puerta a razón del 3.5% del valor declarado, se requiere un listado con los valores asegurados, esta póliza le cubrirá hasta 2 meses si el embarque por algún motivo se tuviera que quedar en bodega de nuestros corresponsales.\n\nVigencia de la oferta: [Quote Valid Days]. Forma de pago: Tramite de factura.`,

    exclusions: `Nuestra tarifa no incluye: demoras portuarias. Bodegajes en aduana, servicio de transbordo si son necesarios, gastos portuarios, utilización de equipos especiales para la entrega después de 2do piso inspecciones extras de aduana si el embarque es solicitado.`,

    goodbye: `Agradecemos la oportunidad de brindarle nuestros servicios, si requieren de alguna información adicional quedamos a las ordenes.\n\nAtentamente,\n\n\n[Quote Creator]\n\n______________________________\nFirma de Aceptación`,
  },
}

export function substitutePlaceholders(text, vars) {
  if (!text) return ''
  const date = vars.date ||
    new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
  const priceStr = vars.price
    ? Number(vars.price).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '___'
  return text
    .replace(/\[Date\]/g,            date)
    .replace(/\[Client Name\]/g,     vars.clientName  || '___')
    .replace(/\[Company\]/g,         vars.company     || '')
    .replace(/\[Origin\]/g,          vars.origin      || '___')
    .replace(/\[Destiny\]/g,         vars.destiny     || '___')
    .replace(/\[Service Type\]/g,    vars.serviceType || '___')
    .replace(/\[Currency\]/g,        vars.currency ? vars.currency + ' ' : '')
    .replace(/\[Price\]/g,           priceStr)
    .replace(/\[Quote Valid Days\]/g, vars.validUntil || '30 days')
    .replace(/\[Quote Creator\]/g,   vars.creatorName || '___')
}

export function buildDefaultSections(language, vars) {
  const lang = language === 'ES' ? 'ES' : 'EN'
  const template = TEMPLATES[lang]
  const result = {}
  SECTION_KEYS.forEach(key => {
    result[key] = substitutePlaceholders(template[key] || '', vars)
  })
  return result
}

export function buildVarsFromVisit(visit, meta, language) {
  const lang = language === 'ES' ? 'ES' : 'EN'
  const clientName = visit?.client?.name || visit?.prospectName || ''
  const company    = visit?.client?.name || ''
  const origin  = [visit?.originCity, visit?.originCountry].filter(Boolean).join(', ')
  const destiny = [visit?.destCity,   visit?.destCountry  ].filter(Boolean).join(', ')
  const rawServiceType = visit?.serviceType || ''
  const serviceType = SERVICE_TYPE_LABELS[lang]?.[rawServiceType] || rawServiceType
  const validUntilStr = meta?.validUntil
    ? new Date(meta.validUntil).toLocaleDateString(lang === 'ES' ? 'es-CR' : 'en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    : ''
  return {
    clientName,
    company,
    origin,
    destiny,
    serviceType,
    currency:     meta?.currency    || 'USD',
    price:        meta?.totalAmount || '',
    validUntil:   validUntilStr,
    creatorName:  meta?.creatorName || '',
  }
}
