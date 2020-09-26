const fs = require('fs')

const DEFAULT_BUFFER_SIZE = 8192
const CR = Buffer.from('\r', 'ascii')[0]
const LF = Buffer.from('\n', 'ascii')[0]

class JsonRpcService {
	constructor(readStream, writeStream, onRequest) {
		this.readFromStream = this.readFromStream.bind(this)

		this.readBuffer = Buffer.allocUnsafe(DEFAULT_BUFFER_SIZE)
		this.readBufferIndex = 0
		this.headers = null
		this.bodyLength = 0

		this.readStream = readStream
		this.writeStream = writeStream
		this.onRequest = onRequest

		readStream.on('readable', this.readFromStream)
	}

	readFromStream() {
		let chunk
		while ((chunk = this.readStream.read()) !== null) {
			this.appendToReadBuffer(chunk)
		}
	}

	appendToReadBuffer(data) {
		if (this.readBufferIndex + data.length >= this.readBuffer.length) {
			this.readBuffer = Buffer.concat(
				[this.readBuffer],
				this.readBuffer.length + Math.max(DEFAULT_BUFFER_SIZE, data.length)
			)
			this.readBuffer.set(data, this.readBufferIndex)
		} else {
			this.readBuffer.set(data, this.readBufferIndex)
		}

		this.readBufferIndex += data.length

		this.process()
	}

	process() {
		this.readHeaders()
		if (!this.headers) return

		this.readBody(this.bodyLength)
		if (!this.body) return

		this.execRequest(this.body)

		this.headers = null
		this.body = null
	}

	readHeaders() {
		if (this.headers) return

		let i = 0
		while (
			i < this.readBufferIndex + 1 &&
			(this.readBuffer[i] !== CR ||
				this.readBuffer[i + 1] !== LF ||
				this.readBuffer[i + 2] !== CR ||
				this.readBuffer[i + 3] !== LF)
		) {
			i += 1
		}

		if (!this.readBuffer[i + 3]) {
			return
		}

		const headerArray = this.readBuffer.toString('ascii', 0, i).split('\r\n')
		const headers = new Map(
			headerArray.map((header) => {
				const [name, ...value] = header.split(':')
				return [name, value.join().trim()]
			})
		)

		this.readBuffer = this.readBuffer.slice(i + 4)
		this.readBufferIndex -= i + 4
		this.headers = headers

		this.bodyLength = parseInt(this.headers.get('Content-Length'), 10)
	}

	readBody(length) {
		if (this.readBufferIndex < length) return
		const data = this.readBuffer.toString('utf8', 0, length)
		this.body = JSON.parse(data)
		this.readBuffer = this.readBuffer.slice(length)
		this.readBufferIndex -= length
	}

	async execRequest(request) {
		if (!Object.prototype.hasOwnProperty.call(request, 'id')) return

		try {
			const result = await this.onRequest(request.method, request.params)
			this.writeResponse({ result, id: request.id })
		} catch (err) {
			this.writeResponse({
				id: request.id,
				error: {
					code: 32000,
					message: err.message,
					data: {
						stack: err.stack,
					},
				},
			})
		}
	}

	writeResponse(response) {
		const responseString = JSON.stringify(
			{ jsonrpc: '2.0', ...response },
			null,
			null
		)

		const responseBuffer = Buffer.from(responseString, 'utf8')
		const headerBuffer = Buffer.from(
			`Content-Length: ${responseBuffer.length}\r\n\r\n`,
			'ascii'
		)
		this.writeStream.write(headerBuffer)
		this.writeStream.write(responseBuffer)
	}
}

module.exports = JsonRpcService
