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

export const IMPORT_TEMPLATES = {
  EN: {
    clientInfo: `[Date]\n\n[Client Name]\n[Company]`,

    salutation: `Dear [Client Name]:\n\nWe would like to thank you for considering us to provide professional services for the transportation of your household goods and personal effects, door to door, from your residence in [Origin] to your new residence in [Destiny].\n\nBelow is a breakdown of the services we will provide:`,

    originPackingServices: `**Packing Services**\n\n- Packing will be carried out at your residence by professional packers using new materials such as bubble wrap, white paper, Styrofoam, corrugated cardboard, and special boxes for packaging.\n- Conditioning of household goods and vehicle in the container.\n- Free storage for 15 days at our warehouses (if required).\n- Preparation of packing lists.\n- Container conditioning and export procedures.\n- Once packing is complete, all items will be placed inside the container and dispatched to [Destiny].`,

    customsPaperWork: `**Customs Procedures for Export**\n\nWe will prepare all necessary forms to comply with customs formalities for the export of the household goods.`,

    internationalFreight: `**International Freight — Ocean**\n\nWe will coordinate land/ocean freight from your residence in [Origin] to the port of [Destiny], in a 40-foot container.`,

    destinationServices: `**Destination Services**\n\nIn [Destiny] we will handle customs procedures for the nationalization of the shipment, transport from the port to your new residence, including unloading, unpacking, arranging items, and removal of all packing materials used.`,

    price: `**Costs and Conditions**\n\nThe cost of our Door to Door services by ocean freight is [Currency][Price]. This rate is based on an estimated ___ cubic meters in a 40-foot container. This rate excludes import taxes, bonded warehouse storage, extra shipping line charges for handling electric batteries, THC/port charges, and customs inspections.\n\nAdditionally, we offer Door to Door insurance at 4% of the declared value of the shipment, with PAC Global Insurance Co. For this, you will need to provide a list of items with detailed values.`,

    serviceSchedule: ``,

    exclusions: ``,

    goodbye: `We hope to have the opportunity to assist you and remain at your service.\n\nSincerely,`,
  },

  ES: {
    clientInfo: `[Date]\n\nSeñor (a): [Client Name]\n[Company]`,

    salutation: `Estimado (a) Sr. [Client Name]:\n\nDeseamos agradecerle el considerarnos en la oferta de servicios profesionales para el traslado de su menaje de casa y efectos personales en un servicio puerta a puerta desde su residencia en [Origin] hasta su nueva residencia en [Destiny].\n\nA continuación, el desglose de los servicios que brindaremos:`,

    originPackingServices: `**Servicios de Embalaje**\n\n-Se efectuará en sus instalaciones con empacadores profesionales quienes utilizan materiales nuevos tales como plástico de burbujas, papel blanco, estereofón, cartón corrugado, además de cajas para el embalaje.\n- Acondicionamiento del menaje de casa y auto en el contenedor.\n- Almacenaje libre por 15 días en nuestras bodegas (en caso de requerirlo).\n-Preparación de listas de empaque.\n- Acondicionamiento y trámites de exportación.\n-Una vez finalizado el embalaje se acondicionarán los bultos dentro del contenedor para luego ser despachados hacia [Destiny].`,

    customsPaperWork: `**Trámites de Aduana para la Exportación**\n\nConfeccionaremos todos los formularios para cumplir con las formalidades aduaneras para la exportación del menaje de casa.`,

    internationalFreight: `**Flete Internacional — Vía Marítimo**\n\nCoorinaremos el flete Terrestre/Marítimo desde su residencia en [Origin] hasta [Destiny] en un contenedor de 40 pies.`,

    destinationServices: `**Servicios de Destino**\n\nEn [Destiny] realizaremos los trámites de aduana para la nacionalización del embarque, traslado de este desde el puerto a la nueva residencia, descarga, desempaque, acomodo y el retiro de materiales de empaque usados.`,

    price: `**Costos y Condiciones**\n\nEl costo por nuestros servicios de Puerta a Puerta por vía marítimo es de [Currency][Price]. Esta tarifa es en base a un estimado de ___ metros cúbicos en un contenedor de 40 pies. Esta tarifa excluye impuestos de importación, bodegajes en almacén fiscal, cargos extras de navieras por manejo de baterías eléctricas, THC/cargos portuarios e inspecciones aduanales.\n\nAdicionalmente ofrecemos un seguro Puerta a Puerta a razón del 4% del valor declarado del embarque con la compañía Pac Global Insurance Co. Para ello es necesario nos proporcione una lista de los artículos con valores detallados.`,

    serviceSchedule: ``,

    exclusions: ``,

    goodbye: `Esperamos nos brinde la oportunidad de asistirle y quedando a sus gratas órdenes, nos suscribimos sus seguros servidores.\n\nMuy atentamente,`,
  },
}

export const AERIAL_TEMPLATES = {
  EN: {
    clientInfo: `[Date]\n\n[Client Name]\n[Company]`,

    salutation: `Dear [Client Name]:\n\nWe want to thank you for considering us in offering our professional services to transport your household goods and personal effects on a door to door service, from [Origin] to [Destiny].\n\nThe services we provide will be detailed as follows:`,

    originPackingServices: `**Packing Services**\n\n-The packaging will be done at your residence with professional packers who use new materials such as bubble wrap, white paper, Styrofoam, corrugated cardboard, plus special boxes for packaging of glassware, china, ornaments, books, clothing, etc.\n-Special wooden boxes will be prepared to provide greater security for fragile items such as pictures, marble, glass and mirrors.\n-All services provided will be strictly supervised.\n-You can have free storage in our warehouse for 30 days, if required.\n-We will provide a detailed packing list.\n-Once packaging is complete, items will be conditioned inside a certified wooden van.`,

    customsPaperWork: `**Customs Procedures for Export**\n\n-We will fill out all the forms to comply with customs formalities for household goods in [Origin] and the exit customs office. To carry out this procedure, only a photocopy of your passport and signature of the shipper forms for PROCOMER is required.`,

    internationalFreight: `**International Air Freight**\n\n-We will coordinate air freight from [Origin] to [Destiny], with an estimated transit time of approximately 10 days.`,

    destinationServices: `**Destination Services**\n\n-Our correspondent in [Destiny] will handle customs clearance for the nationalization of the household goods shipment, transporting it from the airport to your residence, including unloading, unpacking, arranging items, and removal of all packing materials.`,

    price: `**Costs and Conditions**\n\nThe cost of our Door to Door services by air is [Currency][Price]. Our price is based on a shipment of ___ Kilos / ___ cubic meters.\n\nAdditionally, we offer Door to Door insurance at 4% of the declared value of the shipment, with PAC Global Insurance Co. This requires you to provide a detailed item list with the declared value of each article.`,

    serviceSchedule: `This quote is valid for: [Quote Valid Days].\nPayment method: Before shipping.`,

    exclusions: `**Exclusions**\n\nOur price does not include: taxes, temporary storage, port charges, costs for use of special equipment such as forklifts, THC, special trucks for inaccessibility, customs inspections, port delay extra costs, or any other cost that has not been mentioned above. These charges must be paid to our agent at destination.`,

    goodbye: `We hope to have the opportunity to serve you and we remain at your service.\n\nBest Regards,`,
  },

  ES: {
    clientInfo: `Fecha: [Date]\n\nSeñor (a) [Client Name]\n[Company]`,

    salutation: `Estimado (a) [Client Name]\n\nDeseamos agradecerle el considerarnos en la oferta de servicios profesionales para el traslado de su menaje de casa y efectos personales en un servicio Puerta a Puerta desde [Origin] hasta [Destiny].\n\nA continuación, el desglose de los servicios que brindaremos:`,

    originPackingServices: `**Servicios de Embalaje**\n\n-Se efectuará en su residencia con empacadores profesionales, quienes utilizan materiales nuevos tales como plástico con burbujas, papel blanco, estereofón, cartón corrugado, además de cajas para el embalaje (empaque) de cristalería, loza, adornos, libros, ropa, etc.\n-Se confeccionarán cajas especiales de madera para brindar mayor seguridad a los artículos frágiles tales como cuadros, mármol, vidrios y espejos.\n-Habrá supervisión personal del servicio que se esté brindando.\n-Podrá contar con almacenaje libre por 30 días en nuestras bodegas, si así lo requiere.\n-Preparación de lista de empaque.\n-Una vez finalizado el embalaje se acondicionarán los bultos dentro de un van de madera certificada.`,

    customsPaperWork: `**Trámites de Aduana para la Exportación**\n\n-Confeccionaremos todos los formularios para cumplir con las formalidades aduaneras para el menaje de casa en [Origin] y la aduana de salida. Para realizar este trámite es necesario únicamente la fotocopia de su pasaporte y la firma del embarcador de formularios para PROCOMER.`,

    internationalFreight: `**Flete Internacional Vía Aérea**\n\n-Coordinaremos el flete aéreo desde [Origin] hasta [Destiny], con un tiempo de tránsito estimado de 2 días.`,

    destinationServices: `**Servicios de Destino**\n\n-Nuestro corresponsal realizará los trámites de aduana para la nacionalización del embarque de menaje de casa, trasladando el mismo desde el aeropuerto a su residencia en [Destiny], descarga, desempaque, acomodo y retiro de los materiales utilizados.`,

    price: `**Costos y Condiciones**\n\nEl costo de nuestros servicios de Puerta a Puerta por vía aérea es de [Currency][Price]. Hemos basado nuestra tarifa en un embarque de ___ Kilos / ___ metros cúbicos.\n\nAdicionalmente ofrecemos un Seguro puerta a puerta a razón del 4% sobre el valor declarado del embarque, con la compañía Pac Global Insurance Co. Para ello es necesario que nos proporcione una lista de artículos con valores detallados.`,

    serviceSchedule: `Cotización válida por: [Quote Valid Days].\nForma de pago: antes del despacho.`,

    exclusions: `**Exclusiones**\n\nNuestro costo no incluye: impuestos, bodegajes, tasas arancelarias, cargos de aeropuerto, costos por uso de equipo especial para la entrega tales como montacargas, camiones especiales por dificultad de acceso, inspecciones aduanales, costos extra por atrasos portuarios, o cualquier otro costo que no haya sido mencionado anteriormente.`,

    goodbye: `Esperamos nos brinde la oportunidad de asistirle y quedando a sus gratas órdenes, nos suscribimos sus seguros servidores.\n\nMuy Atentamente,`,
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

export function buildDefaultSections(language, vars, serviceType, serviceMode, quoteType) {
  const lang = language === 'ES' ? 'ES' : 'EN'
  const isLocal  = serviceType === 'LOCAL_MOVE'
  const isImport = quoteType === 'IMPORT'
  const isAerial = !isLocal && !isImport && serviceMode === 'AERIAL'
  const template = isLocal ? LOCAL_TEMPLATES[lang]
    : isImport  ? IMPORT_TEMPLATES[lang]
    : isAerial  ? AERIAL_TEMPLATES[lang]
    : TEMPLATES[lang]
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
