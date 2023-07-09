import 'dotenv/config'
import * as turf from '@turf/turf'
import * as fs from 'fs'
import * as proj4 from 'proj4'
import * as axios from 'axios'
import * as PDFDocument from 'pdfkit'
import { PROJECTIONS, Projection } from './projections'

const token = process.env.MAPBOX_API_KEY
const projection = 'PROJCS["WGS 84 / Pseudo-Mercator",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AXIS["Latitude",NORTH],AXIS["Longitude",EAST],AUTHORITY["EPSG","4326"]],PROJECTION["Mercator_1SP"],PARAMETER["central_meridian",0],PARAMETER["scale_factor",1],PARAMETER["false_easting",0],PARAMETER["false_northing",0],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AXIS["X",EAST],AXIS["Y",NORTH],EXTENSION["PROJ4","+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext  +no_defs"],AUTHORITY["EPSG","3857"]]'


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

    const censusTract = getDacFeature(coordinates)
    const loadServingEntity = getElectricLoadServingEntityFeature(coordinates)

    console.log(censusTract)
    console.log(loadServingEntity)

    generatePDF(address, censusTract.properties)
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

const getDacFeature = (coordinates: number[]) => {
    const projectedCoordinates = proj4.default(PROJECTIONS[Projection.DisadvantagedCommunity], coordinates)
    const shapePoint = [projectedCoordinates[0], projectedCoordinates[1]];

    const dacFileName = 'geojson/dac.json'
    const censusTract = findFeature(shapePoint, dacFileName)
    return censusTract
}

const getElectricLoadServingEntityFeature = (coordinates: number[]) => {
    const projectedCoordinates = proj4.default(PROJECTIONS[Projection.ElectricLoadServingEntity], coordinates)
    const shapePoint = [projectedCoordinates[0], projectedCoordinates[1]];
    const fileName = 'geojson/electric_load_serving_entities.json'
    const loadEntity = findFeature(shapePoint, fileName)
    return loadEntity
}

const generatePDF = (address: string, censusTractData: any) => {
    const doc = new PDFDocument.default();

    doc.pipe(fs.createWriteStream('output.pdf'));
    doc.text('Sample site-selection report');
    doc.text(`\n`)
    doc.text(`Address: ${address}`)
    doc.text(`\n`)
    doc.text(`Environmental Factors:`)
    doc.text(`\n`)
    doc.text(`According to CalEnviroScreen 4.0 the site you're looking at has the following characteristics on a scale of 0-100 where 100 is the most burdened and 0 is the least. Sites with lower numbers have better health and environmental indicators than sites with higher numbers. The higher the number the more that indicator is a problem for the state and community, and the greater of a priority it will be for funding in environmental clean-up programs. \n`)
    doc.text(`\n`)
    doc.text(`Population: ${censusTractData.population}`)
    doc.text(`Disadvantaged community score (DAC): ${censusTractData.DACSCORE}`)
    doc.text(`EJ index for PM2.5 in the air: ${censusTractData.pm25}`)
    doc.end();
}

run().then(() => { console.log('done') });






