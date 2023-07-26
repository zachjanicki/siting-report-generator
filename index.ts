import 'dotenv/config'
import * as turf from '@turf/turf'
import * as fs from 'fs'
import * as proj4 from 'proj4'
import * as axios from 'axios'
import * as PDFDocument from 'pdfkit'
import { PROJECTIONS, GEOJSON_FILES, GeoJsonDataset, CSVDatasets, CSV_FILES } from './datasets'
import { readCSV } from './csv_parser'

const token = process.env.MAPBOX_API_KEY

const getCoordinates = async (address: string) => {
    const response = await axios.default.get(`https://api.mapbox.com/geocoding/v5/mapbox.places/${address}.json?access_token=${token}`);
    return response.data.features[0].center
}

const isPointInPolygon = (point: number[], polygon: any) => {
    const turfPoint = turf.point(point)
    const isWithin = turf.booleanPointInPolygon(turfPoint, polygon);
    return isWithin
}

const run = async () => {
    const address = '1001 "I" Street, Sacramento, CA, 95814, USA'
    const coordinates = await getCoordinates(address)

    const censusTract = getFeature(coordinates, GeoJsonDataset.DisadvantagedCommunity)
    const loadServingEntity = getFeature(coordinates, GeoJsonDataset.ElectricLoadServingEntity)
    const airDistrict = getFeature(coordinates, GeoJsonDataset.CaAirDistrict)
    const cleanCitiesCoalition = getFeature(coordinates, GeoJsonDataset.CleanCitiesCoalition)
    const cleanCitiesContact = await getCleanCitiesContact(cleanCitiesCoalition.properties['Name'])
    const caCounty = getFeature(coordinates, GeoJsonDataset.CaCounties)
    const caAssemblyDistrict = getFeature(coordinates, GeoJsonDataset.CaAssemblyDistrict)
    const caCongressionalDistrict = getFeature(coordinates, GeoJsonDataset.CaCongressionalLegislativeDistrict)
    const caSenateDistrict = getFeature(coordinates, GeoJsonDataset.CaSenateLegislativeDistrict)

    const datasets = {
        censusTract,
        loadServingEntity,
        airDistrict,
        cleanCitiesCoalition,
        cleanCitiesContact,
        caCounty,
        caAssemblyDistrict,
        caCongressionalDistrict,
        caSenateDistrict
    }

    generatePDF(address, datasets)
}

const getCleanCitiesContact = async (coalitionName: string) => {
    const contacts = await readCSV(CSV_FILES[CSVDatasets.CleanCitiesCoalition])
    const cleanCitiesContact = contacts.find((contact) => {
        return contact['Coalition'] === coalitionName
    })
    return cleanCitiesContact
}

const getFeature = (coordinates: number[], dataset: GeoJsonDataset) => {
    const projectedCoordinates = proj4.default(PROJECTIONS[dataset], coordinates)
    const shapePoint = [projectedCoordinates[0], projectedCoordinates[1]];
    const feature = findFeature(shapePoint, GEOJSON_FILES[dataset])
    return feature
}

const findFeature = (shapePoint: number[], fileName: string) => {
    const buffer = fs.readFileSync(fileName)
    // @ts-ignore
    const json = JSON.parse(buffer)
    const features = json.features
    const foundFeature = features.find((feature: { geometry: { coordinates: any; }; }) => {
        if (feature.geometry && isPointInPolygon(shapePoint, feature.geometry)) {
            return true
        }
    })
    return foundFeature
}

const generatePDF = (address: string, datasets: any) => {
    const doc = new PDFDocument.default();

    doc.pipe(fs.createWriteStream('output.pdf'));
    doc.text('Sample site-selection report');
    doc.text(`\n`)
    doc.text(`Address: ${address}`)
    doc.text(`\n`)
    doc.text(`Environmental Factors:`)
    doc.text(`\n`)
    doc.text(`According to CalEnviroScreen 4.0 this site has the following characteristics on a scale of 0-100 where 100 is the most burdened and 0 is the least. Sites with lower numbers have better health and environmental indicators than sites with higher numbers. A higher number means that indicator is a problem for the state and community, and the greater of a priority it will be for funding in environmental clean-up programs. \n`)
    doc.text(`\n`)
    doc.text(`Population: ${datasets?.censusTract?.properties.population}`)
    doc.text(`Disadvantaged community score (DAC): ${datasets?.censusTract?.properties.DACSCORE}`)
    doc.text(`EJ index for PM2.5 in the air: ${datasets?.censusTract?.properties.pm25}`)
    doc.text('\n')

    doc.text(`Utility: ${datasets.loadServingEntity.properties['Utility']}`)
    doc.text(`\n`)

    doc.text(`Air quality management district: ${datasets.airDistrict.properties['NAME']}`)
    doc.text(`\n`)

    doc.text(`Clean cities coalition: ${datasets.cleanCitiesCoalition.properties['Name']}`)
    doc.text(`\n`)
    doc.text(`The point of contact for ${datasets.cleanCitiesCoalition.properties['Name']} is ${datasets.cleanCitiesContact['First Name']} ${datasets.cleanCitiesContact['Last Name']}. They can be reached by email at ${datasets.cleanCitiesContact['Email']} or by office phone at ${datasets.cleanCitiesContact['Phone - Office']}.`)
    doc.text(`The headquarters of this clean cities coalition is at ${datasets.cleanCitiesContact['Street Address 1']} ${datasets.cleanCitiesContact['City']}, ${datasets.cleanCitiesContact['State']} ${datasets.cleanCitiesContact['ZIP Code']}`)

    doc.text(`County: ${datasets.caCounty.properties['CountyName']}`)
    doc.text(`\n`)

    doc.text(`California assembly district: ${datasets.caAssemblyDistrict.properties['AssemblyDi']}`)
    doc.text(`\n`)

    doc.text(`Congressional district: ${datasets.caCongressionalDistrict.properties['CongDistri']}`)
    doc.text(`\n`)

    doc.text(`Senate district: ${datasets.caSenateDistrict.properties['SenateDist']}`)
    doc.text(`\n`)
    doc.end();
}

run().then(() => { console.log('done') });






