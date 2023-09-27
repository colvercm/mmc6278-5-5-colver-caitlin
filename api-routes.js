const router = require('express').Router()
const db = require('./db')


// TODO: Create a GET route that returns a list of everything in the inventory table
// The response should look like:
// [
//   {
//     "id": 1,
//     "name": "Stratocaster",
//     "image": "strat.jpg",
//     "description": "One of the most iconic electric guitars ever made.",
//     "price": 599.99,
//     "quantity": 3
//   },
//   {...},
//   {...}, etc
// ]

router
  .route('/inventory')
  .get(async (req, res) => {
    try {
      const [inventory] = await db.query(`SELECT * FROM inventory`);
      res.json.status(204).end();
  } catch (err) {
      res.status(404).send('Error Retrieving Inventory: ' + err.message);
    }
  })

// TODO: Create a POST route that inserts inventory items
// This route will accept price, quantity, name, image, and description as JSON
// in the request body.
// It should return a 204 status code

  .post(async (req, res) => {
    try {
      const { price, quantity, name, image, description } = req.body
      if (!(
        price&&
        quantity&&
        name&& 
        image&& 
        description
      ))
      return 
        res.status(204).send('inventory item added')
  
        await db.query(`
          INSERT INTO inventory (price, quantity, name, image, description)
          VALUES (?, ?, ?, ?, ?)
          `, [price, quantity, name, image, description])

        res.status(204).end();
      } catch (err) {
        res.status(404).send('Error retrieving inventory')  
  }
})
// TODO: Write a GET route that returns a single item from the inventory
// that matches the id from the route parameter
// Should return 404 if no item is found
// The response should look like: 
// {
//   "id": 1,
//   "name": "Stratocaster", 
//   "image": "strat.jpg",
//   "description": "One of the most iconic electric guitars ever made.",
//   "price": 599.99,
//   "quantity": 3
// }
  router
  .route('/inventory/:id')
  .get(async (req, res) => {
    const [[singleItem]] = await db.query(`SELECT * FROM inventory WHERE id=?`,
    [req.params.id]);
    if(!singleItem)
      return res.status(404).send(`Item Not Found`)
  })

  // TODO: Create a PUT route that updates the inventory table based on the id
  // in the route parameter.
  // This route should accept price, quantity, name, description, and image
  // in the request body.
  // If no item is found, return a 404 status.
  // If an item is modified, return a 204 status code.
  .put(async (req, res) =>  {
    const { price, quantity, name, description, image} = req.body
    const [{affectedRows}] = await db.query(
      `UPDATE inventory SET ? WHERE id =?`,
    [{price, quantity, name, description, image }, req.params.id]
    )
    if (affectedRows === 0) return res.status(404).send('item not found')
    else return res.status(204).end()
  })

  // TODO: Create a DELETE route that deletes an item from the inventory table
  // based on the id in the route parameter.
  // If no item is found, return a 404 status.
  // If an item is deleted, return a 204 status code.
  .delete(async (req, res) => {
    try {
      const [{affectedRows}] = await db.query(
        `DELETE FROM inventory WHERE id=?`, 
        req.params.id
        )
        if (affectedRows === 0) return res.status(404).send('item not found')
        res.send('Item deleted')
      }catch(err) {
        res.status(204).end()
      }
    })

router
  .route('/cart')
  .get(async (req, res) => {
    const [cartItems] = await db.query(
      `SELECT
        cart.id,
        cart.inventory_id AS inventoryId,
        cart.quantity,
        inventory.price,
        inventory.name,
        inventory.image,
        inventory.quantity AS inventoryQuantity
      FROM cart INNER JOIN inventory ON cart.inventory_id=inventory.id`
    )
    const [[{total}]] = await db.query(
      `SELECT SUM(cart.quantity * inventory.price) AS total
       FROM cart, inventory WHERE cart.inventory_id=inventory.id`
    )
    res.json({cartItems, total: total || 0})
  })
  .post(async (req, res) => {
    const {inventoryId, quantity} = req.body
    // Using a LEFT JOIN ensures that we always return an existing
    // inventory item row regardless of whether that item is in the cart.
    const [[item]] = await db.query(
      `SELECT
        inventory.id,
        name,
        price,
        inventory.quantity AS inventoryQuantity,
        cart.id AS cartId
      FROM inventory
      LEFT JOIN cart on cart.inventory_id=inventory.id
      WHERE inventory.id=?;`,
      [inventoryId]
    )
    if (!item) return res.status(404).send('Item not found')
    const {cartId, inventoryQuantity} = item
    if (quantity > inventoryQuantity)
      return res.status(409).send('Not enough inventory')
    if (cartId) {
      await db.query(
        `UPDATE cart SET quantity=quantity+? WHERE inventory_id=?`,
        [quantity, inventoryId]
      )
    } else {
      await db.query(
        `INSERT INTO cart(inventory_id, quantity) VALUES (?,?)`,
        [inventoryId, quantity]
      )
    }
    res.status(204).end()
  })
  .delete(async (req, res) => {
    // Deletes the entire cart table
    await db.query('DELETE FROM cart')
    res.status(204).end()
  })

router
  .route('/cart/:cartId')
  .put(async (req, res) => {
    const {quantity} = req.body
    const [[cartItem]] = await db.query(
      `SELECT
        inventory.quantity as inventoryQuantity
        FROM cart
        INNER JOIN inventory on cart.inventory_id=inventory.id
        WHERE cart.id=?`,
        [req.params.cartId]
    )
    if (!cartItem)
      return res.status(404).send('Not found')
    const {inventoryQuantity} = cartItem
    if (quantity > inventoryQuantity)
      return res.status(409).send('Not enough inventory')
    if (quantity > 0) {
      await db.query(
        `UPDATE cart SET quantity=? WHERE id=?`
        ,[quantity, req.params.cartId]
      )
    } else {
      await db.query(
        `DELETE FROM cart WHERE id=?`,
        [req.params.cartId]
      )
    }
    res.status(204).end()
  })
  .delete(async (req, res) => {
    const [{affectedRows}] = await db.query(
      `DELETE FROM cart WHERE id=?`,
      [req.params.cartId]
    )
    if (affectedRows === 1)
      res.status(204).end()
    else
      res.status(404).send('Cart item not found')
  })

module.exports = router
