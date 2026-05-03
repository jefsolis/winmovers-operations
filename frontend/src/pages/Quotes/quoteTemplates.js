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

export const LOCAL_SECTION_KEYS = [
  'clientInfo',
  'salutation',
  'originPackingServices',
  'price',
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
    DOOR_TO_PORT: 'Door to Port',
    DOOR_TO_DOOR: 'Door to Door',
    PACKING:      'Packing',
    LOCAL_MOVE:   'Local Moving',
  },
  ES: {
    DOOR_TO_PORT: 'Puerta a Puerto',
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

    goodbye: `We would like to thank you the opportunity that you give us to present to you our offer. I'm at your service to clarify any questions.\n\nSincerely,`,
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

    goodbye: `Agradecemos la oportunidad de brindarle nuestros servicios, si requieren de alguna información adicional quedamos a las ordenes.\n\nAtentamente,`,
  },
}

// ─── Number → Words ────────────────────────────────────────────────────────────

const ONES_EN = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE',
  'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN']
const TENS_EN = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY']
const ONES_ES = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE']
const TENS_ES = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
const VEINTI_ES = ['', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE']
const HUNDREDS_ES = ['', 'CIEN', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']

function _belowHundred(n, isES) {
  if (n < 20) return isES ? ONES_ES[n] : ONES_EN[n]
  if (isES && n <= 29) return VEINTI_ES[n - 20]
  const tens = isES ? TENS_ES[Math.floor(n / 10)] : TENS_EN[Math.floor(n / 10)]
  const ones = isES ? ONES_ES[n % 10] : ONES_EN[n % 10]
  if (n % 10 === 0) return tens
  return isES ? `${tens} Y ${ones}` : `${tens}-${ones}`
}

function _belowThousand(n, isES) {
  if (n < 100) return _belowHundred(n, isES)
  const h    = Math.floor(n / 100)
  const rest = n % 100
  if (isES) {
    const hw = (h === 1 && rest > 0) ? 'CIENTO' : HUNDREDS_ES[h]
    return rest > 0 ? `${hw} ${_belowHundred(rest, isES)}` : hw
  }
  return rest > 0 ? `${ONES_EN[h]} HUNDRED ${_belowHundred(rest, isES)}` : `${ONES_EN[h]} HUNDRED`
}

function _intToWords(n, isES) {
  if (n === 0) return isES ? 'CERO' : 'ZERO'
  if (n < 1000) return _belowThousand(n, isES)
  if (n < 1_000_000) {
    const th   = Math.floor(n / 1000)
    const rest = n % 1000
    const tw   = isES ? (th === 1 ? 'MIL' : `${_belowThousand(th, isES)} MIL`) : `${_belowThousand(th, isES)} THOUSAND`
    return rest > 0 ? `${tw} ${_belowThousand(rest, isES)}` : tw
  }
  const mil   = Math.floor(n / 1_000_000)
  const rest  = n % 1_000_000
  const mw    = isES ? (mil === 1 ? 'UN MILLÓN' : `${_belowThousand(mil, isES)} MILLONES`) : `${_belowThousand(mil, isES)} MILLION`
  return rest > 0 ? `${mw} ${_intToWords(rest, isES)}` : mw
}

const CURRENCY_NAMES = {
  EN: { USD: 'Dollars', EUR: 'Euros', GBP: 'Pounds Sterling', CRC: 'Colons', COP: 'Colombian Pesos', MXN: 'Mexican Pesos', PEN: 'Soles', CLP: 'Chilean Pesos', ARS: 'Argentine Pesos' },
  ES: { USD: 'Dólares', EUR: 'Euros', GBP: 'Libras Esterlinas', CRC: 'Colones', COP: 'Pesos Colombianos', MXN: 'Pesos Mexicanos', PEN: 'Soles', CLP: 'Pesos Chilenos', ARS: 'Pesos Argentinos' },
}

export function priceToWords(amount, language, currency) {
  const num = parseFloat(amount)
  if (!amount || isNaN(num) || num < 0) return ''
  const isES    = language === 'ES'
  const lang    = isES ? 'ES' : 'EN'
  const intPart = Math.floor(num)
  const cents   = Math.round((num - intPart) * 100)
  const words   = _intToWords(intPart, isES)
  const ccyName = currency ? ` ${CURRENCY_NAMES[lang][currency] || currency}` : ''
  return `${words} ${String(cents).padStart(2, '0')}/100${ccyName}`
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
    .replace(/\[Quote Valid Days\]/g, vars.validUntil  || '30 days')
    .replace(/\[Quote Creator\]/g,   vars.creatorName || '___')
    .replace(/\[Price In Words\]/g,  vars.priceInWords || '___')
}

export const LOCAL_TEMPLATES = {
  EN: {
    clientInfo: `Date: [Date]\n\nMr. (s) [Client Name]\n[Company]`,

    salutation: `Dear Mr./Mrs. [Client Name],\nWe are pleased to present our service offer for the local move of your household goods and personal effects from your current location in [Origin] to your new residence in [Destiny].`,

    originPackingServices: `**Detail of the services we will provide:**\n-Boxes and packing materials will be provided for the packing of smaller items such as decorations, glassware, kitchen items, etc., that you prefer to pack yourself.\n-Wardrobe boxes for hanging clothes.\n-Loading and unloading services will be carried out by our professional staff.\n-1 truck trip will be made on the indicated days.\n-Furniture will be wrapped in the truck with special blankets for proper protection during transport.\n-We have an insurance policy for loading and unloading operations primarily for furniture as well as for walls or floors both at origin and destination, and for boxes packed by our staff.\n-Arrangement of household goods in the new residence according to your instructions.\n-In the case of the bed and any other furniture that needs to be disassembled, it will be properly reassembled at the destination in the location you indicate.\n-Removal of boxes and materials generated after the move, once the client indicates.\n-Return transport of refrigerator to the house of origin.`,

    price: `**Price & Conditions**\n\nThe rate for the aforementioned services is [Currency][Price] plus 13% VAT ([Price In Words]).`,

    exclusions: `Should you require the packing of smaller items such as glassware, dishes, decorations, toys, books, clothing, etc. by our collaborators, this has an additional cost of $5 per packed box, and this service would be carried out one day before the move. The cost per unpacked box after the transfer is $2.50.`,

    goodbye: `Thank you for considering us for your move.\n\nSincerely,`,
  },

  ES: {
    clientInfo: `Fecha: [Date]\n\nSeñor (a) [Client Name]\n[Company]`,

    salutation: `Con mucho gusto le brindamos nuestra oferta de servicios para el traslado local del menaje de casa y efectos personales desde su actual ubicación en [Origin] hasta su nueva residencia en [Destiny].`,

    originPackingServices: `**Detalle de los servicios que le prestaremos:**\n-Se le suministraran cajas y los materiales de empaque necesarios para el empaque de las partidas menores tales como adornos, cristalería, artículos de cocina, etc. Que prefiera empacar por su cuenta.\n-Cajas tipo ropero para la ropa de colgar.\n-El servicio de carga y descarga será realizado por nuestro personal profesional.\n-Se realizaran 1 viajes de camión en los días indicados\n-Se embalaran los muebles en el camión con cobertores especiales para su debida protección durante el traslado.\n-Contamos con póliza de seguros para maniobras de carga y descarga principalmente para los muebles así como para las paredes o pisos tanto en origen como en destino y de las cajas que hayan sido empacadas por nuestro personal.\n-Acondicionamiento del menaje de casa en la nueva residencia de acuerdo a sus instrucciones.\n-En el caso de la cama y algún otro mueble que sea necesario desarmar, quedara en el destino debidamente armado en el lugar que usted nos indique.\n-Retiro de cajas y material que se genere después de la mudanza, una vez que el cliente lo indique.\n-Traslado de vuelta de refrigeradora a la casa de origen.`,

    price: `**Costos y Condiciones**\n\nLa tarifa por los servicios antes mencionados es de [Currency][Price] más 13% IVA ([Price In Words]).`,

    exclusions: `En caso de requerir el empaque de las partidas menores como la cristalería, loza, adornos, juguetes, libros, ropa, etc. por parte de nuestros colaboradores este tiene un costo adicional de $5 por cada caja empacada y este servicio se realizaría un día antes al de la mudanza y el costo por caja desempacada después del traslado es de $ 2.5.`,

    goodbye: `Agradeciendo el habernos tomado en cuenta me suscribo de usted,\n\nMuy atentamente,`,
  },
}

export function buildDefaultSections(language, vars, serviceType) {
  const lang = language === 'ES' ? 'ES' : 'EN'
  const isLocal = serviceType === 'LOCAL_MOVE'
  const template = isLocal ? LOCAL_TEMPLATES[lang] : TEMPLATES[lang]
  const keys = isLocal ? LOCAL_SECTION_KEYS : SECTION_KEYS
  const result = {}
  keys.forEach(key => {
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
  const locale = lang === 'ES' ? 'es-CR' : 'en-GB'
  const dateOpts = { day: '2-digit', month: 'long', year: 'numeric' }
  const validUntilStr = meta?.validUntil
    ? new Date(meta.validUntil).toLocaleDateString(locale, dateOpts)
    : ''
  return {
    date:         new Date().toLocaleDateString(locale, dateOpts),
    clientName,
    company,
    origin,
    destiny,
    serviceType,
    currency:     meta?.currency    || 'USD',
    price:        meta?.totalAmount || '',
    priceInWords: priceToWords(meta?.totalAmount, lang, meta?.currency),
    validUntil:   validUntilStr,
    creatorName:  meta?.creatorName || '',
  }
}
