import Web3 from "web3"
import HttpProvider from "web3-providers-http"

window.resCallback = window.resCallback ? window.resCallback : new Map()
window.eventHandlers = window.eventHandlers ? window.eventHandlers : new Map()

class ElaphantWeb3Provider extends HttpProvider {
	/**
	 * 用于在iOS移动端向webview进行注入。参数为原生代码里定义的Provider配置对象。
	 * @param {Object} embeddedConfig Provider的配置对象。
	 * @param {Boolean} ignoreEthereum 是否重置window.ethereum对象。
	 */
	static initWithConfig(embeddedConfig, ignoreEthereum) {
		let object = new ElaphantWeb3Provider(embeddedConfig.rpcUrl)
		object.isEmbedded = true
		object.address = embeddedConfig.address
		object.chainId = embeddedConfig.chainId
		
		if(!ignoreEthereum){
			object.setEthereum()
		}

		return object
	}

	/**
	 * 用指定的Web App相关的参数去初始化一个Web3 Provider。
	 * @param {String} rpcURL
	 * @param {String} appTitle
	 * @param {String} appID 
	 * @param {String} appName 
	 * @param {String} appPublicKey 
	 * @param {String} developerDID 
	 * @param {Number} randomNumber 
	 * @param {String} accountAddress 如果已知钱包地址，可以在这里传入，则web不再需要频繁去请求用户钱包地址。
	 */
	static initWithParams(rpcURL, appTitle, appID, appName, appPublicKey, developerDID, randomNumber, accountAddress) {
		let object = new ElaphantWeb3Provider(rpcURL)
		object.isEmbedded = false
		object.appTitle = appTitle
		object.appID = appID
		object.appName = appName
		object.appPublicKey = appPublicKey
		object.developerDID = developerDID
		object.randomNumber = randomNumber
		object.address = accountAddress ? accountAddress : ''
		object.chainId = embeddedConfig.chainId
		object.setEthereum()

		return object
	}

	constructor(rpcURL) {
		super(rpcURL, {
			keepAlive: true,
			withCredentials: false,
			timeout: 20000,
			reconnect: {
				auto: true,
				delay: 5000,
				maxAttempts: 5,
				onTimeout: false
			}
		})

		this.isMetamask = true
		this.autoRefreshOnNetworkChange = false
		this.chainId = 20

		setTimeout(() => {
			if (window.eventHandlers.has("connect")) {
				window.eventHandlers.get("connect")()
			}
		}, 5000);
	}

	setEthereum() {
		// if (!window.ethereum) {
		window.ethereum = {
			...this,
			provider: this,
			selectedAddress: this.isEmbedded ? this.address : '',
			sendResponse: this.sendResponse,
			asyncDeleteCallback: this.asyncDeleteCallback,
			rawSendWithinApp: this.rawSendWithinApp,
			checkPayload: this.checkPayload,
			isConnected: this.isConnected,
			_send: this._send,
			// isMetamask: true,
			// autoRefreshOnNetworkChange: false,
			// chainId: 20,
			// isEmbedded: this.isEmbedded,
			on: this.on,
			enable: function () {
				// console.log("调用window.ethereum.enable()")

				return new Promise((resolve, reject) => {
					if (this.provider.isEmbedded) {
						if (this.provider.address) {
							this.selectedAddress = this.provider.address

							if (window.eventHandlers.has("connect")) {
								window.eventHandlers.get("connect")()
							}

							resolve([this.selectedAddress])
						} else {
							reject([])
						}
					} else {
						this.provider.authorise().then(address => {
							this.selectedAddress = address
							if (address === '') {
								reject([])
							} else {
								if (window.eventHandlers.has("connect")) {
									window.eventHandlers.get("connect")()
								}

								resolve([address])
							}
						}).catch(err => {
							console.error(err)

							if (window.eventHandlers.has("error")) {
								window.eventHandlers.get("error")(err)
							}

							reject([])
						})
					}
				})
			},
			request(payload, callback) {
				// console.log("调用window.ethereum.request()", payload, callback)

				if (callback) {
					this.provider.send(payload, callback)
				} else {
					return new Promise((resolve, reject) => {
						this.provider.send(payload).then(res => {
							resolve(res)
						}).catch(err => {
							reject(err)
						})
					})
				}
			},
			send: function (method, callback) {
				// console.log("调用window.ethereum.send()", method, callback)
				// console.log("method参数是", typeof method)

				if (typeof method === "string") {
					this.provider.send({
						method: method,
						params: []
					}, callback)
				} else {
					this.provider.send(method, callback)
				}
			},
			sendAsync: function (payload, callback) {
				// console.log("调用window.ethereum.sendAsync()", payload, callback)
				this.send(payload, callback)
			},
		}
		// }
	}

	on(event, handler) {
		//  case "connect":
		// 	case "message":
		// 	case "data":
		// 	case "error":
		// 	case "disconnect":
		// 	case "chainChanged":
		// 	case "accountsChanged":
		// 	case "close":
		// 	case "networkChanged":
		if (
			event === "connect"
			|| event === "message"
			|| event === "data"
			|| event === "error"
			|| event === "disconnect"
			|| event === "chainChanged"
			|| event === "accountsChanged"
			|| event === "close"
			|| event === "networkChanged"
		) {
			window.eventHandlers.set(event, handler)
			// console.log("注册了事件监听器。", event, handler)
		}
	}

	isConnected() {
		return true
	}

	authorise() {
		let currentURL = window.location.href
		let itsURL = new URL(currentURL)
		let action = itsURL.searchParams.get('action')
		if (action && action === 'auth') {
			var data = ''
			var dataJson = null
			var err = null
			try {
				data = itsURL.searchParams.get('Data')
				dataJson = JSON.parse(decodeURIComponent(data))
				this.selectedAddress = dataJson.ETHAddress
			} catch (error) {
				err = error
			}

			return new Promise((resolve, reject) => {
				if (!this.selectedAddress || err) {
					reject('')
				} else {
					resolve(this.selectedAddress)
				}
			})
		} else {
			itsURL.searchParams.set('action', 'auth')

			let elaphantURL = "elaphant://identity?" +
				"AppID=" + this.appID +
				"&AppName=" + encodeURIComponent(this.appName) +
				"&RandomNumber=" + this.randomNumber +
				"&DID=" + this.developerDID +
				"&PublicKey=" + this.appPublicKey +
				"&ReturnUrl=" + encodeURIComponent(itsURL.toString()) +
				"&RequestInfo=ELAAddress,BTCAddress,ETHAddress"
			let url = "https://launch.elaphant.app/?appName=" + encodeURIComponent(this.appTitle) +
				"&appTitle=" + encodeURIComponent(this.appTitle) +
				"&autoRedirect=True&redirectURL=" + encodeURIComponent(elaphantURL)
			window.location.href = url
		}
	}

	send(payload, callback) {
		// console.log("开始调用 send……", this, payload, callback)

		const id = payload.id ? payload.id : new Date().getTime()
		const params = payload.params ? payload.params : []

		payload.id = id
		payload.jsonrpc = "2.0"
		payload.params = params

		// console.log("修正参数：", payload)

		if (callback) {
			window.resCallback.set(id, callback)
			this._send(payload, id)
		} else {
			if (
				payload.method === "eth_getBalance"
				|| payload.method === "eth_sendTransaction"
				|| payload.method === "eth_requestAccounts"
				|| payload.method === "personal_sign"
				|| payload.method === "personal_ecRecover"
				|| payload.method === "eth_chainId"
				// || payload.method === "eth_accounts"
				// || payload.method === "net_version"
			) {
				return new Promise(resolve => {
					window.resCallback.set(id, result => {
						// console.log("最终回调到js的参数：", result)
						resolve(result)
					})

					// console.log("为没有回调的请求生成回调方法：", window.resCallback)
					this._send(payload, id)
				})
			} else {
				return new Promise(resolve => {
					window.resCallback.set(id, (error, result) => {
						if (error) {
							if (window.eventHandlers.has("error")) {
								window.eventHandlers.get("error")(error)
							}

							this.asyncDeleteCallback(id)

							return console.error("RPC返回错误：", error, result)
						}

						// if (window.eventHandlers.has("data")) {
						// 	window.eventHandlers.get("data")(result)
						// }

						// console.log("最终回调到js的参数：", result)
						if (result.result) {
							resolve(result.result)
						} else {
							resolve(result)
						}

						this.asyncDeleteCallback(id)
					})

					// console.log("为没有回调的请求生成回调方法：", window.resCallback)
					this._send(payload, id)
				})
			}
		}
	}

	rawSendWithinApp(payload, id) {
		// console.log("组装请求对象 rawSendWithinApp", payload, id)

		let jsBridge
		if (this.isEmbedded) {
			const param = {
				name: payload.method,
				object: payload.params,
				id: id
			}

			if (window.JsBridgeAndroid) {
				jsBridge = window.JsBridgeAndroid
				jsBridge.postMessage(JSON.stringify(param))

				// console.log("提交Android", JSON.stringify(param))
			} else {
				jsBridge = window.webkit.messageHandlers[payload.method]
				jsBridge.postMessage(JSON.stringify(param))

				// console.log("提交iOS", JSON.stringify(param))
			}
		} else {
			super.send(payload, window.resCallback.get(id))
		}
	}

	_send(payload, id) {
		// console.log("开始调用 _send……", payload, id)

		let jsBridge
		switch (payload.method) {
			case "eth_chainId":
				this.sendResponse(id, "0x" + this.chainId.toString(16))
				// {
				// 	id: id,
				// 	jsonrpc: "2.0",
				// 	result: "0x" + this.chainId.toString(16)
				// }
				break;

			case "eth_getBalance":
				// console.log("这是一个 eth_getBalance 交易。", payload, id)

				// console.log("window.JsBridgeAndroid =", window.JsBridgeAndroid)
				this.rawSendWithinApp(payload, id)
				break

			case 'eth_sendTransaction':
				// console.log("这是一个eth_sendTransaction交易。", payload.params)

				this.sendTransaction(payload.params, id)
				break

			case "eth_accounts":
				// console.log("开始调用 eth_accounts：", this.address, this.isEmbedded, id, window.resCallback.get(id).length)

				if (this.isEmbedded) {
					const foo = window.resCallback.get(id)
					if (this.address) {
						if (foo.length === 1) {
							foo([this.address])
						} else {
							foo(null, {
								id: id,
								jsonrpc: "2.0",
								result: [this.address]
							})
						}
					} else {
						if (foo.length === 1) {
							foo([])
						} else {
							foo("NO ADDRESS", {
								id: id,
								jsonrpc: "2.0",
								result: []
							})
						}
					}
				} else {
					this.authorise().then(address => {
						if (address === '') {
							window.resCallback.get(id)("NO ADDRESS!", [])
						} else {
							window.resCallback.get(id)(null, [address])
						}
					}).catch(err => {
						window.resCallback.get(id)(err, [])
					}).finally(() => {
						this.asyncDeleteCallback(id)
					})
				}
				break

			case 'eth_requestAccounts':
				if (this.isEmbedded) {
					if (window.resCallback.has(id)) {
						if (this.address) {
							window.resCallback.get(id)([this.address])
						} else {
							window.resCallback.get(id)([])
						}
						this.asyncDeleteCallback(id)
					} else {
						return new Promise((resolve, reject) => {
							if (this.address) {
								resolve([this.address])
							} else {
								reject([])
							}
						})
					}
				} else {
					if (window.resCallback.has(id)) {
						this.authorise().then(address => {
							if (address === '') {
								window.resCallback.get(id)("NO ADDRESS!", [])
							} else {
								window.resCallback.get(id)(null, [address])
							}
						}).catch(err => {
							window.resCallback.get(id)(err, [])
						}).finally(() => {
							this.asyncDeleteCallback(id)
						})
					} else {
						return new Promise((resolve, reject) => {
							this.authorise().then(address => {
								if (address === '') {
									reject([])
								} else {
									resolve([address])
								}
							}).catch(err => {
								console.error(err)

								if (window.eventHandlers.has("error")) {
									window.eventHandlers.get("error")(err)
								}

								reject([])
							})
						})
					}
				}
				break

			case 'personal_sign':
				if (this.isEmbedded) {
					if (window.JsBridgeAndroid) {
						jsBridge = window.JsBridgeAndroid
					} else {
						jsBridge = window.webkit.messageHandlers['signPersonalMessage']
					}

					jsBridge.postMessage({
						name: 'signPersonalMessage',
						object: payload.params,
						id: 0
					})
				} else {
					super.send(payload, window.resCallback.get(id))
				}
				break

			case 'personal_ecRecover':
				if (this.isEmbedded) {
					if (window.JsBridgeAndroid) {
						jsBridge = window.JsBridgeAndroid
					} else {
						jsBridge = window.webkit.messageHandlers['ecRecover']
					}

					jsBridge.postMessage({
						name: 'ecRecover',
						object: payload.params,
						id: 0
					})
				} else {
					super.send(payload, window.resCallback.get(id))
				}
				break

			default:
				if (payload.params && payload.params.length > 0 && typeof payload.params[0] === "object") {
					this.checkPayload(payload.params[0])
				}

				// console.log(payload.method, "↑↑↑↑↑↑↑↑↑↑交易被传给super……", payload, window.resCallback.get(id))

				super.send(payload, window.resCallback.get(id))
		}
	}

	checkPayload(payload) {
		// if (!payload.from || payload.from === "") {
		// 	payload.from = this.address;
		// }

		if (!payload.gas) {
			delete payload["gas"]
		}

		if (!payload.gasPrice) {
			delete payload["gasPrice"]
		}
	}

	sendTransaction(args, id) {
		// console.log("开始调用　sendTransaction", args, id)

		if (this.isEmbedded) {
			const param = {
				name: 'signTransaction',
				object: args,
				id: id
			}

			let jsBridge
			if (window.JsBridgeAndroid) {
				jsBridge = window.JsBridgeAndroid
				jsBridge.postMessage(JSON.stringify(param))
			} else {
				jsBridge = window.webkit.messageHandlers['signTransaction']
				jsBridge.postMessage(JSON.stringify(param))
			}
		} else {
			let returnUrl = new URL(window.location.href)
			if (returnUrl.searchParams.get('action') === 'auth') {
				returnUrl.searchParams.delete('Data')
				returnUrl.searchParams.delete('Sign')
			}
			returnUrl.searchParams.set('action', 'tx')

			let arg = args[0]
			let orderID = "";
			let elaphantURL = "elaphant://calleth?DID=" + this.developerDID +
				"&AppID=" + this.appID +
				"&AppName=" + encodeURIComponent(this.appName) +
				"&Description=" + encodeURIComponent(this.appName) +
				"&PublicKey=" + this.appPublicKey +
				"&OrderID=" + orderID +
				"&CoinName=Ethsc" +
				"&to=" + arg.to +
				"&value=" + parseInt(arg.value) +
				"&price=" + parseInt(arg.gasPrice) +
				"&gas=" + parseInt(arg.gas) +
				"&data=" + arg.data +
				"&ReturnUrl=" + encodeURIComponent(returnUrl.toString());

			let url = "https://launch.elaphant.app/?appName=" + encodeURIComponent(this.appTitle) +
				"&appTitle=" + encodeURIComponent(this.appTitle) +
				"&autoRedirect=True&redirectURL=" + encodeURIComponent(elaphantURL);
			window.location.href = url;
		}
	}

	sendResponse(id, result) {
		// console.log("调用 sendResponse", id, result, this.isEmbedded, window.resCallback.get(id), window.resCallback)

		if (this.isEmbedded && window.resCallback.has(id)) {
			window.resCallback.get(id)(result)
			this.asyncDeleteCallback(id)
		}
	}

	asyncDeleteCallback(id) {
		setTimeout(() => {
			if (window.resCallback.has(id)) {
				window.resCallback.delete(id)
			}
		}, 10000);
	}
}

window.Web3 = Web3
window.ElaphantWeb3Provider = ElaphantWeb3Provider
window.Trust = ElaphantWeb3Provider
window.detectEthereumProvider = function () { return new Promise(function (resolve, reject) { if (window.web3.currentProvider) { resolve(window.web3.currentProvider); } else { reject(null); } }); };